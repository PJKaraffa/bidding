let currentUser = null;
let currentProfile = null;
let editingBidId = null;

/* =========================================================
   STARTUP / AUTHENTICATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error.message);
    showLogin();
    return;
  }

  if (!data.session) {
    showLogin();
    return;
  }

  currentUser = data.session.user;

  if (!(await ensureProfile()) || !(await loadProfile())) {
    showLogin();
    return;
  }

  showApp();
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const message = document.getElementById("loginMessage");

  message.textContent = "";

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    message.textContent = error.message;
    return;
  }

  currentUser = data.user;

  const profileReady = await ensureProfile();

  if (!profileReady) {
    await supabaseClient.auth.signOut();
    showLogin();
    return;
  }

  const profileLoaded = await loadProfile();

  if (!profileLoaded) {
    await supabaseClient.auth.signOut();
    showLogin();
    return;
  }

  showApp();
}
async function logout() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }

  currentUser = null;
  currentProfile = null;
  editingBidId = null;

  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("loginMessage").textContent = "";

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
    `${currentProfile.vendor_name || currentUser.email} | Role: ${currentProfile.role}`;

  document.getElementById("adminPanel").classList.toggle(
    "hidden",
    currentProfile.role !== "admin"
  );

  loadBids();
}

/* =========================================================
   PROFILE
========================================================= */

async function ensureProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile lookup error:", error);
    alert(`Profile error: ${error.message}`);
    return false;
  }

  if (!data) {
    const { error: insertError } = await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        email: currentUser.email,
        role: "vendor",
        vendor_name: currentUser.email
      });

    if (insertError) {
      console.error("Profile creation error:", insertError);
      alert(`Profile creation error: ${insertError.message}`);
      return false;
    }
  }

  return true;
}
async function loadProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) {
    console.error("Profile loading error:", error.message);
    alert("Profile not found.");
    return false;
  }

  currentProfile = data;
  return true;
}

/* =========================================================
   CREATE / UPDATE BID
========================================================= */

async function saveBid() {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can create or edit bids.");
    return;
  }

  const title = valueOf("bidTitle");
  const description = valueOf("bidDescription");
  const studentId = valueOf("studentId");
  const streetAddress = valueOf("streetAddress");
  const pickupTime = valueOf("pickupTime");
  const school = valueOf("school");
  const schoolStartTime = valueOf("schoolStartTime");
  const serviceDate = valueOf("serviceDate");
  const openLocal = valueOf("bidOpenDate");
  const closeLocal = valueOf("bidCloseDate");

  if (
    !title || !studentId || !streetAddress || !pickupTime || !school ||
    !schoolStartTime || !serviceDate || !openLocal || !closeLocal
  ) {
    alert("Please complete all required bid fields.");
    return;
  }

  const openDate = localInputToDate(openLocal);
  const closeDate = localInputToDate(closeLocal);

  if (!openDate || !closeDate) {
    alert("Please enter valid bid opening and closing dates.");
    return;
  }

  if (closeDate <= openDate) {
    alert("The bid closing date must be later than the opening date.");
    return;
  }

  const bidData = {
    title,
    description,
    student_id: studentId,
    street_address: streetAddress,
    pickup_time: pickupTime,
    school,
    school_start_time: schoolStartTime,
    service_date: serviceDate,
    // datetime-local is interpreted as local browser time, then saved as UTC ISO.
    bid_open_date: openDate.toISOString(),
    bid_close_date: closeDate.toISOString()
  };

  let result;

  if (editingBidId !== null) {
    result = await supabaseClient
      .from("transportation_bids")
      .update(bidData)
      .eq("id", editingBidId);
  } else {
    result = await supabaseClient
      .from("transportation_bids")
      .insert({
        ...bidData,
        status: "open",
        created_by: currentUser.id
      });
  }

  if (result.error) {
    console.error("Save bid error:", result.error.message);
    alert(result.error.message);
    return;
  }

  alert(editingBidId !== null ? "Bid updated." : "Bid posted.");
  cancelBidEdit();
  await loadBids();
}

async function editBid(bidId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can edit bids.");
    return;
  }

  const { data: bid, error } = await supabaseClient
    .from("transportation_bids")
    .select("*")
    .eq("id", bidId)
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  editingBidId = bid.id;

  setValue("bidTitle", bid.title);
  setValue("bidDescription", bid.description);
  setValue("studentId", bid.student_id);
  setValue("streetAddress", bid.street_address);
  setValue("pickupTime", normalizeTimeForInput(bid.pickup_time));
  setValue("school", bid.school);
  setValue("schoolStartTime", normalizeTimeForInput(bid.school_start_time));
  setValue("serviceDate", bid.service_date);
  setValue("bidOpenDate", isoToLocalInput(bid.bid_open_date));
  setValue("bidCloseDate", isoToLocalInput(bid.bid_close_date));

  document.getElementById("bidFormHeading").textContent = "Edit Transportation Bid";
  document.getElementById("saveBidButton").textContent = "Update Bid";
  document.getElementById("cancelEditButton").classList.remove("hidden");
  document.getElementById("editMessage").classList.remove("hidden");

  document.getElementById("adminPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function cancelBidEdit() {
  editingBidId = null;
  clearBidForm();

  document.getElementById("bidFormHeading").textContent = "Create Transportation Bid";
  document.getElementById("saveBidButton").textContent = "Post Bid";
  document.getElementById("cancelEditButton").classList.add("hidden");
  document.getElementById("editMessage").classList.add("hidden");
}

function clearBidForm() {
  [
    "bidTitle", "bidDescription", "studentId", "streetAddress",
    "pickupTime", "school", "schoolStartTime", "serviceDate",
    "bidOpenDate", "bidCloseDate"
  ].forEach(id => setValue(id, ""));
}

/* =========================================================
   LOAD BID CARDS
========================================================= */

async function loadBids() {
  const container = document.getElementById("bidsList");
  container.innerHTML = "<p>Loading transportation bids...</p>";

  const { data: bids, error } = await supabaseClient
    .from("transportation_bids")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load bids error:", error.message);
    container.innerHTML = `<p class="error-message">${escapeHTML(error.message)}</p>`;
    return;
  }

  container.innerHTML = "";

  if (!bids?.length) {
    container.innerHTML = "<p>No transportation bids posted yet.</p>";
    return;
  }

  const isAdmin = currentProfile.role === "admin";

  for (const bid of bids) {
    const myBid = isAdmin ? null : await getMyBid(bid.id);
    const lowBid = await getLowBid(bid.id);
    const submissions = isAdmin ? await getAdminSubmissions(bid.id) : [];

    const finalized = bid.status === "finalized";
    const myResult = !isAdmin && finalized
      ? getVendorResultHTML(bid, myBid)
      : "";

    const adminSummary = isAdmin && finalized
      ? getAdminFinalizedSummary(bid, submissions)
      : "";

    const lowBidHTML = buildLowBidHTML(lowBid, isAdmin, Boolean(myBid), finalized);
    const card = document.createElement("article");
    card.className = "bid-card";
    card.id = `bid-card-${bid.id}`;

    card.innerHTML = `
      <div class="bid-header" onclick="toggleBid(${bid.id})" role="button" tabindex="0">
        <div class="bid-header-title">
          <span id="arrow-${bid.id}" class="bid-arrow">${finalized ? "▶" : "▼"}</span>
          <h3>${escapeHTML(bid.title)}</h3>
        </div>
        ${isAdmin ? adminSummary : myResult}
      </div>

      <div id="details-${bid.id}" class="bid-details ${finalized ? "collapsed" : "expanded"}">
        <p><strong>Description:</strong> ${escapeHTML(bid.description || "")}</p>

        <div class="bid-grid">
          <p><strong>Student ID:</strong> ${escapeHTML(bid.student_id)}</p>
          <p><strong>Street Address:</strong> ${escapeHTML(bid.street_address)}</p>
          <p><strong>Pickup Time:</strong> ${formatTime(bid.pickup_time)}</p>
          <p><strong>School:</strong> ${escapeHTML(bid.school)}</p>
          <p><strong>School Start Time:</strong> ${formatTime(bid.school_start_time)}</p>
          <p><strong>Service Date:</strong> ${formatDate(bid.service_date)}</p>
        </div>

        <p><strong>Bid Opens:</strong> ${formatDateTime(bid.bid_open_date)}</p>
        <p><strong>Bid Closes:</strong> ${formatDateTime(bid.bid_close_date)}</p>
        <p><span class="status">${escapeHTML(String(bid.status).toUpperCase())}</span></p>
        ${lowBidHTML}
      </div>
    `;

    const details = card.querySelector(`#details-${bid.id}`);

    if (!isAdmin && !finalized) {
      details.insertAdjacentHTML("beforeend", vendorBidHTML(bid, myBid));
    }

    if (isAdmin) {
      details.insertAdjacentHTML("beforeend", adminBidHTML(bid, submissions));
    }

    container.appendChild(card);
  }
}

function toggleBid(bidId) {
  const details = document.getElementById(`details-${bidId}`);
  const arrow = document.getElementById(`arrow-${bidId}`);

  if (!details) return;

  const opening = details.classList.contains("collapsed");
  details.classList.toggle("collapsed", !opening);
  details.classList.toggle("expanded", opening);
  if (arrow) arrow.textContent = opening ? "▼" : "▶";
}

/* =========================================================
   LOW BID / VENDOR BID / ADMIN DATA
========================================================= */

async function getLowBid(bidId) {
  const { data, error } = await supabaseClient.rpc("get_low_bid", {
    p_bid_id: bidId
  });

  if (error) {
    console.error("Low bid error:", error.message);
    return null;
  }

  return data?.[0] || null;
}

async function getMyBid(bidId) {
  if (currentProfile.role !== "vendor") {
    return null;
  }

  const { data, error } = await supabaseClient
    .from("bid_submissions")
    .select(`
      id,
      bid_id,
      vendor_id,
      amount,
      notes,
      created_at
    `)
    .eq("bid_id", bidId)
    .eq("vendor_id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("My bid error:", error.message);
    return null;
  }

  return data;
}
}

async function getAdminSubmissions(bidId) {
  const { data, error } = await supabaseClient
    .from("bid_submissions")
    .select(`
      id,
      bid_id,
      vendor_id,
      amount,
      notes,
      created_at,
      updated_at,
      vendor:profiles!bid_submissions_vendor_profile_fk (
        email,
        vendor_name
      )
    `)
    .eq("bid_id", bidId)
    .order("amount", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Admin submissions error:", error.message);
    return { error: error.message, rows: [] };
  }

  return { error: null, rows: data || [] };
}

function buildLowBidHTML(lowBid, isAdmin, vendorHasBid, finalized) {
  if (isAdmin) {
    if (!lowBid) return `<p class="low-bid">Current Low Bid: No bids yet</p>`;

    return `
      <p class="low-bid">
        Current Low Bid: $${Number(lowBid.amount).toFixed(2)}
        ${lowBid.vendor_name ? ` - ${escapeHTML(lowBid.vendor_name)}` : ""}
      </p>
    `;
  }

  if (!vendorHasBid || finalized || !lowBid) return "";

  return `<p class="low-bid">Current Low Bid: $${Number(lowBid.amount).toFixed(2)}</p>`;
}

function getVendorResultHTML(bid, myBid) {
  if (!myBid) {
    return `<span class="result-label result-no-bid">NO BID SUBMITTED</span>`;
  }

  return Number(bid.awarded_bid_id) === Number(myBid.id)
    ? `<span class="result-label result-won">WON</span>`
    : `<span class="result-label result-lost">LOST</span>`;
}

function getAdminFinalizedSummary(bid, submissionsResult) {
  const rows = submissionsResult?.rows || [];
  const winner = rows.find(row => Number(row.id) === Number(bid.awarded_bid_id));

  if (!winner) {
    return `<div class="finalized-summary">Finalized</div>`;
  }

  const winnerName = winner.vendor?.vendor_name || winner.vendor?.email || "Unknown Vendor";

  return `
    <div class="finalized-summary">
      <span class="result-label result-won">WON</span>
      ${escapeHTML(winnerName)} | $${Number(winner.amount).toFixed(2)}
    </div>
  `;
}

function vendorBidHTML(bid, myBid) {
  const now = new Date();
  const openDate = new Date(bid.bid_open_date);
  const closeDate = new Date(bid.bid_close_date);
  const canBid = bid.status === "open" && now >= openDate && now <= closeDate;

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

      <label for="amount-${bid.id}">Bid Amount</label>
      <input
        id="amount-${bid.id}"
        type="number"
        min="0.01"
        step="0.01"
        value="${myBid ? Number(myBid.amount).toFixed(2) : ""}"
        placeholder="Bid Amount"
      >

      <label for="notes-${bid.id}">Optional Notes</label>
      <textarea id="notes-${bid.id}" placeholder="Optional Notes">${escapeHTML(myBid?.notes || "")}</textarea>

      <button type="button" onclick="submitBid(${bid.id})">
        ${myBid ? "Update Bid" : "Submit Bid"}
      </button>
    </div>
  `;
}

async function submitBid(bidId) {
  if (currentProfile.role !== "vendor") {
    alert("Only vendors can submit bids.");
    return;
  }

  const amount = Number(document.getElementById(`amount-${bidId}`)?.value);
  const notes = document.getElementById(`notes-${bidId}`)?.value.trim() || "";

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid bid amount.");
    return;
  }

  const { error } = await supabaseClient
    .from("bid_submissions")
    .upsert(
      {
        bid_id: bidId,
        vendor_id: currentUser.id,
        amount,
        notes
      },
      { onConflict: "bid_id,vendor_id" }
    );

  if (error) {
    alert(error.message);
    return;
  }

  alert("Your bid was saved.");
  await loadBids();
}

/* =========================================================
   ADMIN CONTROLS
========================================================= */

function adminBidHTML(bid, submissionsResult) {
  const rows = submissionsResult?.rows || [];
  const loadError = submissionsResult?.error;

  let html = `
    <div class="admin-box">
      <h4>Admin Controls</h4>
      <div class="admin-buttons">
        <button type="button" class="warning" onclick="editBid(${bid.id})">Edit Bid</button>
  `;

  if (bid.status !== "finalized") {
    html += `
      <button type="button" class="gray" onclick="closeBid(${bid.id})">Close Bid</button>
      <button type="button" class="success" onclick="finalizeBid(${bid.id})">Finalize Bid</button>
    `;
  }

  html += `
        <button type="button" class="danger" onclick="deleteBid(${bid.id})">Delete Bid</button>
      </div>
  `;

  if (loadError) {
    return `${html}<p class="error-message">Error loading vendor bids: ${escapeHTML(loadError)}</p></div>`;
  }

  if (!rows.length) {
    return `${html}<p>No vendor bids submitted yet.</p></div>`;
  }

  html += `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Email</th>
            <th>Amount</th>
            <th>Notes</th>
            <th>Submitted</th>
            <th>Result / Action</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const submission of rows) {
    const isWinner = Number(bid.awarded_bid_id) === Number(submission.id);
    const vendorName = submission.vendor?.vendor_name || submission.vendor?.email || "Unknown Vendor";
    const vendorEmail = submission.vendor?.email || "";

    let actionHTML;

    if (bid.status === "finalized") {
      actionHTML = isWinner
        ? `<span class="result-label result-won">WON</span>`
        : `<span class="result-label result-lost">LOST</span>`;
    } else {
      actionHTML = isWinner
        ? `<button type="button" class="success" onclick="awardBid(${bid.id}, ${submission.id})">Selected Winner</button>`
        : `<button type="button" onclick="awardBid(${bid.id}, ${submission.id})">Select</button>`;
    }

    html += `
      <tr class="${isWinner ? "winner-row" : ""}">
        <td>${escapeHTML(vendorName)}</td>
        <td>${escapeHTML(vendorEmail)}</td>
        <td>$${Number(submission.amount).toFixed(2)}</td>
        <td>${escapeHTML(submission.notes || "")}</td>
        <td>${formatDateTime(submission.created_at)}</td>
        <td>${actionHTML}</td>
      </tr>
    `;
  }

  return `${html}</tbody></table></div></div>`;
}

async function awardBid(bidId, submissionId) {
  if (currentProfile.role !== "admin") return;
  if (!confirm("Select this vendor as the winning bidder?")) return;

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

  await loadBids();
}

async function closeBid(bidId) {
  if (currentProfile.role !== "admin") return;
  if (!confirm("Close this bid? Vendors will no longer be able to submit or update bids.")) return;

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({ status: "closed" })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadBids();
}

async function finalizeBid(bidId) {
  if (currentProfile.role !== "admin") return;

  const { data: bid, error: readError } = await supabaseClient
    .from("transportation_bids")
    .select("awarded_bid_id")
    .eq("id", bidId)
    .single();

  if (readError) {
    alert(readError.message);
    return;
  }

  if (!bid.awarded_bid_id) {
    alert("Select a winning vendor before finalizing the bid.");
    return;
  }

  if (!confirm("Finalize this bid? Vendors will see WON or LOST.")) return;

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({ status: "finalized" })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadBids();
}

async function deleteBid(bidId) {
  if (currentProfile.role !== "admin") return;
  if (!confirm("Delete this bid and all connected vendor submissions?")) return;

  const { error } = await supabaseClient
    .from("transportation_bids")
    .delete()
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  if (editingBidId === bidId) cancelBidEdit();
  await loadBids();
}

/* =========================================================
   DATE / TIME HELPERS
========================================================= */

// Parse YYYY-MM-DDTHH:mm as LOCAL browser time.
function localInputToDate(value) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match.map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Convert a stored UTC/timestamptz value back to local datetime-local format.
function isoToLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    "-",
    pad2(date.getMonth() + 1),
    "-",
    pad2(date.getDate()),
    "T",
    pad2(date.getHours()),
    ":",
    pad2(date.getMinutes())
  ].join("");
}

function normalizeTimeForInput(value) {
  if (!value) return "";
  const parts = String(value).split(":");
  return parts.length >= 2 ? `${pad2(parts[0])}:${pad2(parts[1])}` : "";
}

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? escapeHTML(value) : date.toLocaleDateString("en-US");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return escapeHTML(value);

  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function formatTime(value) {
  if (!value) return "";

  const [rawHour, minute] = String(value).split(":");
  let hour = Number(rawHour);
  if (!Number.isFinite(hour) || minute === undefined) return escapeHTML(value);

  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${period}`;
}

/* =========================================================
   SMALL HELPERS
========================================================= */

function valueOf(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value || "";
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
