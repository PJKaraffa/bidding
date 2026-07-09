let currentUser = null;
let currentProfile = null;

document.addEventListener("DOMContentLoaded", async () => {
  const { data } = await supabaseClient.auth.getSession();

  if (data.session) {
    currentUser = data.session.user;
    await ensureProfile();
    await loadProfile();
    showApp();
  } else {
    showLogin();
  }
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const msg = document.getElementById("loginMessage");

  msg.textContent = "";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.textContent = error.message;
    return;
  }

  currentUser = data.user;

  await ensureProfile();
  await loadProfile();
  showApp();
}

async function logout() {
  await supabaseClient.auth.signOut();

  currentUser = null;
  currentProfile = null;

  showLogin();
}

function showLogin() {
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("appPage").classList.add("hidden");
}

function showApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");

  document.getElementById("welcomeMessage").textContent =
    `${currentUser.email} | Role: ${currentProfile.role}`;

  if (currentProfile.role === "admin") {
    document.getElementById("adminPanel").classList.remove("hidden");
  } else {
    document.getElementById("adminPanel").classList.add("hidden");
  }

  loadBids();
}

async function ensureProfile() {
  const { data } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (!data) {
    await supabaseClient.from("profiles").insert({
      id: currentUser.id,
      email: currentUser.email,
      role: "vendor",
      vendor_name: currentUser.email
    });
  }
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    alert("Profile not found.");
    return;
  }

  currentProfile = data;
}

async function createBid() {
  const title = document.getElementById("bidTitle").value.trim();
  const description = document.getElementById("bidDescription").value.trim();

  const studentId = document.getElementById("studentId").value.trim();
  const streetAddress = document.getElementById("streetAddress").value.trim();
  const pickupTime = document.getElementById("pickupTime").value;
  const school = document.getElementById("school").value.trim();
  const schoolStartTime = document.getElementById("schoolStartTime").value;

  const serviceDate = document.getElementById("serviceDate").value;
  const openDate = document.getElementById("bidOpenDate").value;
  const closeDate = document.getElementById("bidCloseDate").value;

  if (!title || !studentId || !streetAddress || !school || !openDate || !closeDate) {
    alert("Bid title, student ID, street address, school, bid open date, and bid close date are required.");
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .insert({
      title,
      description,
      student_id: studentId,
      street_address: streetAddress,
      pickup_time: pickupTime || null,
      school,
      school_start_time: schoolStartTime || null,
      service_date: serviceDate || null,
      bid_open_date: openDate,
      bid_close_date: closeDate,
      created_by: currentUser.id,
      status: "open"
    });

  if (error) {
    alert(error.message);
    return;
  }

  clearBidForm();
  loadBids();
}

function clearBidForm() {
  document.getElementById("bidTitle").value = "";
  document.getElementById("bidDescription").value = "";
  document.getElementById("studentId").value = "";
  document.getElementById("streetAddress").value = "";
  document.getElementById("pickupTime").value = "";
  document.getElementById("school").value = "";
  document.getElementById("schoolStartTime").value = "";
  document.getElementById("serviceDate").value = "";
  document.getElementById("bidOpenDate").value = "";
  document.getElementById("bidCloseDate").value = "";
}

async function loadBids() {
  const { data: bids, error } = await supabaseClient
    .from("transportation_bids")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  const container = document.getElementById("bidsList");
  container.innerHTML = "";

  if (!bids || bids.length === 0) {
    container.innerHTML = "<p>No transportation bids posted yet.</p>";
    return;
  }

  for (const bid of bids) {
    const lowBid = await getLowBid(bid.id);
    const myBid = await getMyBid(bid.id);

    const div = document.createElement("div");
    div.className = "bid-card";

    div.innerHTML = `
      <h3>${escapeHTML(bid.title)}</h3>

      <p><strong>Description:</strong> ${escapeHTML(bid.description || "")}</p>

      <div class="grid">
        <p><strong>Student ID:</strong> ${escapeHTML(bid.student_id || "")}</p>
        <p><strong>Street Address:</strong> ${escapeHTML(bid.street_address || "")}</p>
        <p><strong>Pickup Time:</strong> ${formatTime(bid.pickup_time)}</p>
        <p><strong>School:</strong> ${escapeHTML(bid.school || "")}</p>
        <p><strong>School Start Time:</strong> ${formatTime(bid.school_start_time)}</p>
        <p><strong>Service Date:</strong> ${formatDate(bid.service_date)}</p>
      </div>

      <p><strong>Bid Opens:</strong> ${formatDateTime(bid.bid_open_date)}</p>
      <p><strong>Bid Closes:</strong> ${formatDateTime(bid.bid_close_date)}</p>

      <p><span class="status">${bid.status.toUpperCase()}</span></p>

      <p class="low-bid">
        Current Low Bid: ${
          lowBid ? "$" + Number(lowBid.amount).toFixed(2) : "No bids yet"
        }
      </p>
    `;

    if (currentProfile.role === "vendor") {
      div.innerHTML += vendorBidHTML(bid, myBid);
    }

    if (currentProfile.role === "admin") {
      div.innerHTML += await adminBidHTML(bid);
    }

    container.appendChild(div);
  }
}

async function getLowBid(bidId) {
  const { data } = await supabaseClient
    .from("bid_submissions")
    .select("*")
    .eq("bid_id", bidId)
    .order("amount", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data;
}

async function getMyBid(bidId) {
  if (currentProfile.role !== "vendor") return null;

  const { data } = await supabaseClient
    .from("bid_submissions")
    .select("*")
    .eq("bid_id", bidId)
    .eq("vendor_id", currentUser.id)
    .maybeSingle();

  return data;
}

function vendorBidHTML(bid, myBid) {
  const now = new Date();
  const open = new Date(bid.bid_open_date);
  const close = new Date(bid.bid_close_date);

  const canBid =
    bid.status === "open" &&
    now >= open &&
    now <= close;

  if (!canBid) {
    return `
      <div class="vendor-bid-box">
        <h4>Your Bid</h4>
        <p>Bidding is not currently open.</p>
        ${
          myBid
            ? `<p><strong>Your Submitted Bid:</strong> $${Number(myBid.amount).toFixed(2)}</p>`
            : `<p>You have not submitted a bid.</p>`
        }
      </div>
    `;
  }

  return `
    <div class="vendor-bid-box">
      <h4>Your Bid</h4>

      ${
        myBid
          ? `<p><strong>Your Current Bid:</strong> $${Number(myBid.amount).toFixed(2)}</p>`
          : `<p>You have not submitted a bid yet.</p>`
      }

      <input id="amount-${bid.id}" type="number" step="0.01" placeholder="Bid Amount">
      <textarea id="notes-${bid.id}" placeholder="Optional Notes"></textarea>

      <button onclick="submitBid(${bid.id})">
        ${myBid ? "Update Bid" : "Submit Bid"}
      </button>
    </div>
  `;
}

async function submitBid(bidId) {
  const amount = document.getElementById(`amount-${bidId}`).value;
  const notes = document.getElementById(`notes-${bidId}`).value.trim();

  if (!amount || Number(amount) <= 0) {
    alert("Enter a valid bid amount.");
    return;
  }

  const { error } = await supabaseClient
    .from("bid_submissions")
    .upsert({
      bid_id: bidId,
      vendor_id: currentUser.id,
      amount: Number(amount),
      notes
    }, {
      onConflict: "bid_id,vendor_id"
    });

  if (error) {
    alert(error.message);
    return;
  }

  loadBids();
}

async function adminBidHTML(bid) {
  const { data: submissions, error } = await supabaseClient
    .from("bid_submissions")
    .select(`
      id,
      amount,
      notes,
      created_at,
      profiles (
        email,
        vendor_name
      )
    `)
    .eq("bid_id", bid.id)
    .order("amount", { ascending: true });

  let html = `
    <div class="admin-box">
      <h4>Admin Controls</h4>

      <button class="gray" onclick="closeBid(${bid.id})">Close Bid</button>
      <button class="success" onclick="finalizeBid(${bid.id})">Finalize Bid</button>
      <button class="danger" onclick="deleteBid(${bid.id})">Delete Bid</button>
  `;

  if (error) {
    html += `<p>Error loading vendor bids.</p></div>`;
    return html;
  }

  if (!submissions || submissions.length === 0) {
    html += `<p>No vendor bids submitted yet.</p>`;
  } else {
    html += `
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Email</th>
            <th>Amount</th>
            <th>Notes</th>
            <th>Submitted</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    submissions.forEach(s => {
      const selected = bid.awarded_bid_id === s.id ? "Selected Winner" : "Select";

      html += `
        <tr>
          <td>${escapeHTML(s.profiles?.vendor_name || "")}</td>
          <td>${escapeHTML(s.profiles?.email || "")}</td>
          <td>$${Number(s.amount).toFixed(2)}</td>
          <td>${escapeHTML(s.notes || "")}</td>
          <td>${formatDateTime(s.created_at)}</td>
          <td>
            <button onclick="awardBid(${bid.id}, ${s.id})">${selected}</button>
          </td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;
  }

  html += `</div>`;
  return html;
}

async function awardBid(bidId, submissionId) {
  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({
      awarded_bid_id: submissionId,
      status: "awarded"
    })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  loadBids();
}

async function closeBid(bidId) {
  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({ status: "closed" })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  loadBids();
}

async function finalizeBid(bidId) {
  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({ status: "finalized" })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  loadBids();
}

async function deleteBid(bidId) {
  if (!confirm("Delete this bid and all submitted vendor bids?")) return;

  const { error } = await supabaseClient
    .from("transportation_bids")
    .delete()
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  loadBids();
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value + "T00:00:00");
  return d.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  return d.toLocaleString();
}

function formatTime(value) {
  if (!value) return "";
  const parts = value.split(":");
  let hour = Number(parts[0]);
  const minute = parts[1];

  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;

  return `${hour}:${minute} ${ampm}`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}