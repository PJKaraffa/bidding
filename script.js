let currentUser = null;
let currentProfile = null;

/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error.message);
    showLogin();
    return;
  }

  if (data.session) {
    currentUser = data.session.user;

    const profileReady = await ensureProfile();

    if (!profileReady) {
      showLogin();
      return;
    }

    const profileLoaded = await loadProfile();

    if (!profileLoaded) {
      showLogin();
      return;
    }

    showApp();
  } else {
    showLogin();
  }
});

/* =========================================================
   LOGIN / LOGOUT
========================================================= */

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const message = document.getElementById("loginMessage");

  message.textContent = "";

  if (!email || !password) {
    message.textContent = "Please enter your email and password.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
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
    return;
  }

  const profileLoaded = await loadProfile();

  if (!profileLoaded) {
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

  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
  document.getElementById("loginMessage").textContent = "";

  showLogin();
}

/* =========================================================
   PAGE DISPLAY
========================================================= */

function showLogin() {
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("appPage").classList.add("hidden");
}

function showApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");

  document.getElementById("welcomeMessage").textContent =
    `${currentUser.email} | Role: ${currentProfile.role}`;

  const adminPanel = document.getElementById("adminPanel");

  if (currentProfile.role === "admin") {
    adminPanel.classList.remove("hidden");
  } else {
    adminPanel.classList.add("hidden");
  }

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
    console.error("Profile lookup error:", error.message);
    alert("Unable to check your profile.");
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
      console.error("Profile creation error:", insertError.message);
      alert(insertError.message);
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
   CREATE TRANSPORTATION BID
========================================================= */

async function createBid() {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can create bids.");
    return;
  }

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

  if (
    !title ||
    !studentId ||
    !streetAddress ||
    !pickupTime ||
    !school ||
    !schoolStartTime ||
    !serviceDate ||
    !openDate ||
    !closeDate
  ) {
    alert("Please complete all required bid fields.");
    return;
  }

  const openDateObject = new Date(openDate);
  const closeDateObject = new Date(closeDate);

  if (closeDateObject <= openDateObject) {
    alert("The bid close date must be later than the bid open date.");
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .insert({
      title,
      description,
      student_id: studentId,
      street_address: streetAddress,
      pickup_time: pickupTime,
      school,
      school_start_time: schoolStartTime,
      service_date: serviceDate,
      bid_open_date: openDate,
      bid_close_date: closeDate,
      created_by: currentUser.id,
      status: "open"
    });

  if (error) {
    console.error("Create bid error:", error.message);
    alert(error.message);
    return;
  }

  clearBidForm();
  await loadBids();
}

function clearBidForm() {
  const fields = [
    "bidTitle",
    "bidDescription",
    "studentId",
    "streetAddress",
    "pickupTime",
    "school",
    "schoolStartTime",
    "serviceDate",
    "bidOpenDate",
    "bidCloseDate"
  ];

  fields.forEach(id => {
    const element = document.getElementById(id);

    if (element) {
      element.value = "";
    }
  });
}

/* =========================================================
   LOAD ALL TRANSPORTATION BIDS
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
    container.innerHTML = `<p>${escapeHTML(error.message)}</p>`;
    return;
  }

  container.innerHTML = "";

  if (!bids || bids.length === 0) {
    container.innerHTML = "<p>No transportation bids posted yet.</p>";
    return;
  }

  const isAdmin = currentProfile.role === "admin";
  const isVendor = currentProfile.role === "vendor";

  for (const bid of bids) {
    const lowBid = await getLowBid(bid.id);
    const myBid = isVendor ? await getMyBid(bid.id) : null;
    const winningBid = bid.awarded_bid_id
      ? await getWinningBid(bid.awarded_bid_id)
      : null;

    const isFinalized = bid.status === "finalized";
    const vendorSubmittedBid = Boolean(myBid);

    let summaryHTML = "";
    let lowBidHTML = "";

    /* -----------------------------------------------------
       ADMIN SUMMARY
    ----------------------------------------------------- */

    if (isAdmin && isFinalized) {
      if (winningBid) {
        const winnerName =
          winningBid.profiles?.vendor_name ||
          winningBid.profiles?.email ||
          "Unknown Vendor";

        summaryHTML = `
          <div class="finalized-summary">
            <span class="result-label result-won">WON</span>
            ${escapeHTML(winnerName)}
            &nbsp;|&nbsp;
            $${Number(winningBid.amount).toFixed(2)}
          </div>
        `;
      } else {
        summaryHTML = `
          <div class="finalized-summary">
            Finalized — No winning vendor found
          </div>
        `;
      }
    }

    /* -----------------------------------------------------
       VENDOR FINAL RESULT
    ----------------------------------------------------- */

    if (isVendor && isFinalized) {
      if (!vendorSubmittedBid) {
        summaryHTML = `
          <div class="result-label result-no-bid">
            NO BID SUBMITTED
          </div>
        `;
      } else if (
        winningBid &&
        Number(winningBid.id) === Number(myBid.id)
      ) {
        summaryHTML = `
          <div class="result-label result-won">
            WON
          </div>
        `;
      } else {
        summaryHTML = `
          <div class="result-label result-lost">
            LOST
          </div>
        `;
      }
    }

    /* -----------------------------------------------------
       LOW BID DISPLAY
    ----------------------------------------------------- */

    if (isAdmin) {
      if (lowBid) {
        const lowVendorName =
          lowBid.profiles?.vendor_name ||
          lowBid.profiles?.email ||
          "Unknown Vendor";

        lowBidHTML = `
          <p class="low-bid">
            Current Low Bid:
            $${Number(lowBid.amount).toFixed(2)}
            -
            ${escapeHTML(lowVendorName)}
          </p>
        `;
      } else {
        lowBidHTML = `
          <p class="low-bid">
            Current Low Bid: No bids yet
          </p>
        `;
      }
    }

    /*
      Vendors only see the current low bid if they have
      submitted a bid and the bid has not been finalized.
    */
    if (isVendor && vendorSubmittedBid && !isFinalized) {
      if (lowBid) {
        lowBidHTML = `
          <p class="low-bid">
            Current Low Bid:
            $${Number(lowBid.amount).toFixed(2)}
          </p>
        `;
      } else {
        lowBidHTML = `
          <p class="low-bid">
            Current Low Bid: No bids yet
          </p>
        `;
      }
    }

    /*
      Vendors who have not submitted a bid do not see
      any low-bid information.
    */
    if (isVendor && !vendorSubmittedBid) {
      lowBidHTML = "";
    }

    /*
      Vendors do not see the winning dollar amount
      after finalization.
    */
    if (isVendor && isFinalized) {
      lowBidHTML = "";
    }

    const collapsedClass = isFinalized ? "collapsed" : "expanded";
    const arrow = isFinalized ? "▶" : "▼";

    const card = document.createElement("div");
    card.className = "bid-card";
    card.id = `bid-card-${bid.id}`;

    card.innerHTML = `
      <div
        class="bid-header"
        onclick="toggleBid(${bid.id})"
        role="button"
        tabindex="0"
      >
        <div class="bid-header-title">
          <span id="arrow-${bid.id}" class="bid-arrow">${arrow}</span>
          <h3>${escapeHTML(bid.title)}</h3>
        </div>

        ${summaryHTML}
      </div>

      <div
        id="details-${bid.id}"
        class="bid-details ${collapsedClass}"
      >
        <p>
          <strong>Description:</strong>
          ${escapeHTML(bid.description || "")}
        </p>

        <div class="grid">
          <p>
            <strong>Student ID:</strong>
            ${escapeHTML(bid.student_id || "")}
          </p>

          <p>
            <strong>Street Address:</strong>
            ${escapeHTML(bid.street_address || "")}
          </p>

          <p>
            <strong>Pickup Time:</strong>
            ${formatTime(bid.pickup_time)}
          </p>

          <p>
            <strong>School:</strong>
            ${escapeHTML(bid.school || "")}
          </p>

          <p>
            <strong>School Start Time:</strong>
            ${formatTime(bid.school_start_time)}
          </p>

          <p>
            <strong>Service Date:</strong>
            ${formatDate(bid.service_date)}
          </p>
        </div>

        <p>
          <strong>Bid Opens:</strong>
          ${formatDateTime(bid.bid_open_date)}
        </p>

        <p>
          <strong>Bid Closes:</strong>
          ${formatDateTime(bid.bid_close_date)}
        </p>

        <p>
          <span class="status">
            ${escapeHTML(String(bid.status).toUpperCase())}
          </span>
        </p>

        ${lowBidHTML}
      </div>
    `;

    const details = card.querySelector(`#details-${bid.id}`);

    if (isVendor && !isFinalized) {
      details.insertAdjacentHTML(
        "beforeend",
        vendorBidHTML(bid, myBid)
      );
    }

    if (isAdmin) {
      const adminHTML = await adminBidHTML(bid);

      details.insertAdjacentHTML(
        "beforeend",
        adminHTML
      );
    }

    container.appendChild(card);
  }
}

/* =========================================================
   COLLAPSE / EXPAND BID
========================================================= */

function toggleBid(bidId) {
  const details = document.getElementById(`details-${bidId}`);
  const arrow = document.getElementById(`arrow-${bidId}`);

  if (!details) {
    return;
  }

  const currentlyCollapsed = details.classList.contains("collapsed");

  if (currentlyCollapsed) {
    details.classList.remove("collapsed");
    details.classList.add("expanded");

    if (arrow) {
      arrow.textContent = "▼";
    }
  } else {
    details.classList.remove("expanded");
    details.classList.add("collapsed");

    if (arrow) {
      arrow.textContent = "▶";
    }
  }
}

/* =========================================================
   LOW BID
========================================================= */

async function getLowBid(bidId) {
  const { data, error } = await supabaseClient
    .from("bid_submissions")
    .select(`
      id,
      bid_id,
      vendor_id,
      amount,
      notes,
      created_at,
      profiles:vendor_id (
        email,
        vendor_name
      )
    `)
    .eq("bid_id", bidId)
    .order("amount", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Low bid error:", error.message);
    return null;
  }

  return data;
}

/* =========================================================
   WINNING BID
========================================================= */

async function getWinningBid(awardedBidId) {
  if (!awardedBidId) {
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
      created_at,
      profiles:vendor_id (
        email,
        vendor_name
      )
    `)
    .eq("id", awardedBidId)
    .maybeSingle();

  if (error) {
    console.error("Winning bid error:", error.message);
    return null;
  }

  return data;
}

/* =========================================================
   VENDOR'S OWN BID
========================================================= */

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

/* =========================================================
   VENDOR BID AREA
========================================================= */

function vendorBidHTML(bid, myBid) {
  const now = new Date();
  const openDate = new Date(bid.bid_open_date);
  const closeDate = new Date(bid.bid_close_date);

  const canBid =
    bid.status === "open" &&
    now >= openDate &&
    now <= closeDate;

  if (!canBid) {
    return `
      <div class="vendor-bid-box">
        <h4>Your Bid</h4>

        <p>Bidding is not currently open.</p>

        ${
          myBid
            ? `
              <p>
                <strong>Your Submitted Bid:</strong>
                $${Number(myBid.amount).toFixed(2)}
              </p>
            `
            : `
              <p>You have not submitted a bid.</p>
            `
        }
      </div>
    `;
  }

  return `
    <div class="vendor-bid-box">
      <h4>Your Bid</h4>

      ${
        myBid
          ? `
            <p>
              <strong>Your Current Bid:</strong>
              $${Number(myBid.amount).toFixed(2)}
            </p>
          `
          : `
            <p>You have not submitted a bid yet.</p>
          `
      }

      <input
        id="amount-${bid.id}"
        type="number"
        min="0.01"
        step="0.01"
        value="${myBid ? Number(myBid.amount).toFixed(2) : ""}"
        placeholder="Bid Amount"
      >

      <textarea
        id="notes-${bid.id}"
        placeholder="Optional Notes"
      >${myBid ? escapeHTML(myBid.notes || "") : ""}</textarea>

      <button onclick="submitBid(${bid.id})">
        ${myBid ? "Update Bid" : "Submit Bid"}
      </button>
    </div>
  `;
}

/* =========================================================
   SUBMIT OR UPDATE VENDOR BID
========================================================= */

async function submitBid(bidId) {
  if (currentProfile.role !== "vendor") {
    alert("Only vendors can submit bids.");
    return;
  }

  const amountElement = document.getElementById(`amount-${bidId}`);
  const notesElement = document.getElementById(`notes-${bidId}`);

  if (!amountElement || !notesElement) {
    alert("Unable to locate the bid entry fields.");
    return;
  }

  const amount = Number(amountElement.value);
  const notes = notesElement.value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Enter a valid bid amount.");
    return;
  }

  const { data: bid, error: bidError } = await supabaseClient
    .from("transportation_bids")
    .select("status, bid_open_date, bid_close_date")
    .eq("id", bidId)
    .single();

  if (bidError) {
    alert(bidError.message);
    return;
  }

  const now = new Date();
  const openDate = new Date(bid.bid_open_date);
  const closeDate = new Date(bid.bid_close_date);

  if (
    bid.status !== "open" ||
    now < openDate ||
    now > closeDate
  ) {
    alert("This bid is not currently open.");
    await loadBids();
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
      {
        onConflict: "bid_id,vendor_id"
      }
    );

  if (error) {
    console.error("Submit bid error:", error.message);
    alert(error.message);
    return;
  }

  alert("Your bid was saved.");
  await loadBids();
}

/* =========================================================
   ADMIN BID TABLE
========================================================= */

async function adminBidHTML(bid) {
  const { data: submissions, error } = await supabaseClient
    .from("bid_submissions")
    .select(`
      id,
      bid_id,
      vendor_id,
      amount,
      notes,
      created_at,
      profiles:vendor_id (
        email,
        vendor_name
      )
    `)
    .eq("bid_id", bid.id)
    .order("amount", { ascending: true })
    .order("created_at", { ascending: true });

  let html = `
    <div class="admin-box">
      <h4>Admin Controls</h4>

      <div class="admin-buttons">
  `;

  if (bid.status !== "finalized") {
    html += `
      <button
        class="gray"
        onclick="closeBid(${bid.id})"
      >
        Close Bid
      </button>

      <button
        class="success"
        onclick="finalizeBid(${bid.id})"
      >
        Finalize Bid
      </button>
    `;
  }

  html += `
      <button
        class="danger"
        onclick="deleteBid(${bid.id})"
      >
        Delete Bid
      </button>

      </div>
  `;

  if (error) {
    console.error("Admin bid loading error:", error.message);

    html += `
      <p class="error-message">
        Error loading vendor bids: ${escapeHTML(error.message)}
      </p>
    </div>
    `;

    return html;
  }

  if (!submissions || submissions.length === 0) {
    html += `
      <p>No vendor bids submitted yet.</p>
    </div>
    `;

    return html;
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

  submissions.forEach(submission => {
    const vendorName =
      submission.profiles?.vendor_name ||
      submission.profiles?.email ||
      "Unknown Vendor";

    const vendorEmail =
      submission.profiles?.email || "";

    const isWinner =
      Number(bid.awarded_bid_id) === Number(submission.id);

    let actionHTML = "";

    if (bid.status === "finalized") {
      actionHTML = isWinner
        ? `<span class="result-label result-won">WON</span>`
        : `<span class="result-label result-lost">LOST</span>`;
    } else if (isWinner) {
      actionHTML = `
        <button
          class="selected-winner-button"
          onclick="awardBid(${bid.id}, ${submission.id})"
        >
          Selected Winner
        </button>
      `;
    } else {
      actionHTML = `
        <button
          onclick="awardBid(${bid.id}, ${submission.id})"
        >
          Select
        </button>
      `;
    }

    html += `
      <tr class="${isWinner ? "winner-row" : ""}">
        <td>${escapeHTML(vendorName)}</td>

        <td>${escapeHTML(vendorEmail)}</td>

        <td>
          $${Number(submission.amount).toFixed(2)}
        </td>

        <td>
          ${escapeHTML(submission.notes || "")}
        </td>

        <td>
          ${formatDateTime(submission.created_at)}
        </td>

        <td>
          ${actionHTML}
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  </div>
  `;

  return html;
}

/* =========================================================
   SELECT WINNING BID
========================================================= */

async function awardBid(bidId, submissionId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can select a winner.");
    return;
  }

  const confirmed = confirm(
    "Select this vendor as the winning bidder?"
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({
      awarded_bid_id: submissionId,
      status: "awarded"
    })
    .eq("id", bidId);

  if (error) {
    console.error("Award bid error:", error.message);
    alert(error.message);
    return;
  }

  await loadBids();
}

/* =========================================================
   CLOSE BID
========================================================= */

async function closeBid(bidId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can close bids.");
    return;
  }

  const confirmed = confirm(
    "Close this bid? Vendors will no longer be able to submit or update bids."
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({
      status: "closed"
    })
    .eq("id", bidId);

  if (error) {
    console.error("Close bid error:", error.message);
    alert(error.message);
    return;
  }

  await loadBids();
}

/* =========================================================
   FINALIZE BID
========================================================= */

async function finalizeBid(bidId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can finalize bids.");
    return;
  }

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
    alert("Please select a winning vendor before finalizing the bid.");
    return;
  }

  const confirmed = confirm(
    "Finalize this bid? Vendors will see whether they won or lost."
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({
      status: "finalized"
    })
    .eq("id", bidId);

  if (error) {
    console.error("Finalize bid error:", error.message);
    alert(error.message);
    return;
  }

  await loadBids();
}

/* =========================================================
   DELETE BID
========================================================= */

async function deleteBid(bidId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can delete bids.");
    return;
  }

  const confirmed = confirm(
    "Delete this transportation bid and every vendor submission connected to it?"
  );

  if (!confirmed) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .delete()
    .eq("id", bidId);

  if (error) {
    console.error("Delete bid error:", error.message);
    alert(error.message);
    return;
  }

  await loadBids();
}

/* =========================================================
   FORMATTING
========================================================= */

function formatDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHTML(value);
  }

  return date.toLocaleDateString("en-US");
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHTML(value);
  }

  return date.toLocaleString("en-US");
}

function formatTime(value) {
  if (!value) {
    return "";
  }

  const parts = String(value).split(":");

  if (parts.length < 2) {
    return escapeHTML(value);
  }

  let hour = Number(parts[0]);
  const minute = parts[1];

  if (!Number.isFinite(hour)) {
    return escapeHTML(value);
  }

  const period = hour >= 12 ? "PM" : "AM";

  hour = hour % 12 || 12;

  return `${hour}:${minute} ${period}`;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
