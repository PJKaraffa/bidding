from pathlib import Path

html = r'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transportation Bidding System</title>
  <link rel="stylesheet" href="./style.css?v=30">
</head>

<body>

  <!-- LOGIN PAGE -->
  <section id="loginPage" class="login-card">
    <h1>Transportation Bidding</h1>
    <h2>Staff / Vendor Login</h2>

    <form id="loginForm">
      <input
        id="email"
        type="email"
        autocomplete="username"
        placeholder="Email"
        required
      >

      <input
        id="password"
        type="password"
        autocomplete="current-password"
        placeholder="Password"
        required
      >

      <button id="loginButton" type="submit">Login</button>
    </form>

    <p id="loginMessage"></p>
  </section>

  <!-- APPLICATION -->
  <div id="appPage" class="hidden">

    <header>
      <div>
        <h1>Transportation Bidding System</h1>
        <p id="welcomeMessage"></p>
      </div>

      <button id="logoutButton" type="button">Logout</button>
    </header>

    <main>

      <!-- ADMIN CREATE / EDIT FORM -->
      <section id="adminPanel" class="card hidden">

        <h2 id="bidFormHeading">Create Transportation Bid</h2>

        <p id="editMessage" class="edit-message hidden">
          You are editing an existing transportation bid.
        </p>

        <form id="bidForm">

          <input
            id="bidTitle"
            type="text"
            placeholder="Bid Title"
            required
          >

          <textarea
            id="bidDescription"
            placeholder="Bid Description / Notes"
          ></textarea>

          <div class="grid">
            <input
              id="studentId"
              type="text"
              placeholder="Student ID"
              required
            >

            <input
              id="streetAddress"
              type="text"
              placeholder="Street Address"
              required
            >
          </div>

          <div class="grid">
            <div>
              <label for="pickupTime">Pickup Time</label>
              <input
                id="pickupTime"
                type="time"
                required
              >
            </div>

            <div>
              <label for="schoolStartTime">School Start Time</label>
              <input
                id="schoolStartTime"
                type="time"
                required
              >
            </div>
          </div>

          <input
            id="school"
            type="text"
            placeholder="School"
            required
          >

          <div class="grid">
            <div>
              <label for="serviceDate">Service Date</label>
              <input
                id="serviceDate"
                type="date"
                required
              >
            </div>

            <div>
              <label for="bidOpenDate">Bid Opens</label>
              <input
                id="bidOpenDate"
                type="datetime-local"
                required
              >
            </div>

            <div>
              <label for="bidCloseDate">Bid Closes</label>
              <input
                id="bidCloseDate"
                type="datetime-local"
                required
              >
            </div>
          </div>

          <div class="form-actions">
            <button id="saveBidButton" type="submit">Post Bid</button>

            <button
              id="cancelEditButton"
              class="gray hidden"
              type="button"
            >
              Cancel Edit
            </button>
          </div>

        </form>
      </section>

      <!-- BIDS -->
      <section class="card">
        <h2>Transportation Bids</h2>
        <div id="bidsList"></div>
      </section>

    </main>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="./supabase-config.js?v=30"></script>
  <script src="./script.js?v=30"></script>
</body>
</html>
'''

js = r'''let currentUser = null;
let currentProfile = null;
let editingBidId = null;

/* =========================================================
   STARTUP
========================================================= */

document.addEventListener("DOMContentLoaded", initializeApp);

async function initializeApp() {
  bindStaticEvents();

  try {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      showLoginMessage(error.message);
      showLogin();
      return;
    }

    if (!data.session) {
      showLogin();
      return;
    }

    currentUser = data.session.user;

    const profileLoaded = await loadCurrentProfile();

    if (!profileLoaded) {
      showLogin();
      return;
    }

    showApp();
  } catch (error) {
    console.error("Startup error:", error);
    showLoginMessage(error.message || "Unable to start the application.");
    showLogin();
  }
}

function bindStaticEvents() {
  document
    .getElementById("loginForm")
    ?.addEventListener("submit", handleLoginSubmit);

  document
    .getElementById("logoutButton")
    ?.addEventListener("click", logout);

  document
    .getElementById("bidForm")
    ?.addEventListener("submit", handleBidFormSubmit);

  document
    .getElementById("cancelEditButton")
    ?.addEventListener("click", cancelBidEdit);

  document
    .getElementById("bidsList")
    ?.addEventListener("click", handleBidListClick);
}

/* =========================================================
   LOGIN / LOGOUT
========================================================= */

async function handleLoginSubmit(event) {
  event.preventDefault();
  await login();
}

async function login() {
  const email = valueOf("email");
  const password = document.getElementById("password")?.value || "";

  showLoginMessage("");

  if (!email || !password) {
    showLoginMessage("Please enter your email and password.");
    return;
  }

  const loginButton = document.getElementById("loginButton");
  setButtonBusy(loginButton, true, "Logging in...");

  try {
    const { data, error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      console.error("Login error:", error);
      showLoginMessage(error.message);
      return;
    }

    if (!data.user || !data.session) {
      showLoginMessage("Login did not return a valid user session.");
      return;
    }

    currentUser = data.user;

    const profileLoaded = await loadCurrentProfile();

    if (!profileLoaded) {
      await supabaseClient.auth.signOut();
      return;
    }

    showLoginMessage("");
    showApp();
  } catch (error) {
    console.error("Login exception:", error);
    showLoginMessage(error.message || "Unexpected login error.");
  } finally {
    setButtonBusy(loginButton, false, "Login");
  }
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

  setValue("email", "");
  setValue("password", "");
  showLoginMessage("");
  cancelBidEdit();
  showLogin();
}

/* =========================================================
   PAGE DISPLAY
========================================================= */

function showLogin() {
  document.getElementById("loginPage")?.classList.remove("hidden");
  document.getElementById("appPage")?.classList.add("hidden");
}

function showApp() {
  document.getElementById("loginPage")?.classList.add("hidden");
  document.getElementById("appPage")?.classList.remove("hidden");

  const welcome = document.getElementById("welcomeMessage");

  if (welcome) {
    welcome.textContent =
      `${currentProfile.vendor_name || currentUser.email} | Role: ${currentProfile.role}`;
  }

  document.getElementById("adminPanel")?.classList.toggle(
    "hidden",
    currentProfile.role !== "admin"
  );

  loadBids();
}

function showLoginMessage(message) {
  const element = document.getElementById("loginMessage");

  if (element) {
    element.textContent = message || "";
  }
}

/* =========================================================
   PROFILE
========================================================= */

async function loadCurrentProfile() {
  /*
    This version reads the profile directly.
    It does not require a custom profile RPC.
  */

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile loading error:", error);
    showLoginMessage(`Profile error: ${error.message}`);
    return false;
  }

  if (data) {
    currentProfile = data;
    return true;
  }

  const { data: createdProfile, error: createError } =
    await supabaseClient
      .from("profiles")
      .insert({
        id: currentUser.id,
        email: currentUser.email,
        role: "vendor",
        vendor_name: currentUser.email
      })
      .select()
      .single();

  if (createError) {
    console.error("Profile creation error:", createError);
    showLoginMessage(`Profile creation error: ${createError.message}`);
    return false;
  }

  currentProfile = createdProfile;
  return true;
}

/* =========================================================
   CREATE / UPDATE BID
========================================================= */

async function handleBidFormSubmit(event) {
  event.preventDefault();
  await saveBid();
}

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
    !title ||
    !studentId ||
    !streetAddress ||
    !pickupTime ||
    !school ||
    !schoolStartTime ||
    !serviceDate ||
    !openLocal ||
    !closeLocal
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

    /*
      datetime-local is entered in the browser's local time.
      Converting to ISO stores the correct absolute time in Supabase.
    */
    bid_open_date: openDate.toISOString(),
    bid_close_date: closeDate.toISOString()
  };

  const saveButton = document.getElementById("saveBidButton");

  setButtonBusy(
    saveButton,
    true,
    editingBidId === null ? "Posting..." : "Updating..."
  );

  try {
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
          created_by: currentUser.id,
          status: "open"
        });
    }

    if (result.error) {
      console.error("Save bid error:", result.error);
      alert(result.error.message);
      return;
    }

    alert(editingBidId === null ? "Bid posted." : "Bid updated.");
    cancelBidEdit();
    await loadBids();
  } finally {
    setButtonBusy(saveButton, false, editingBidId === null ? "Post Bid" : "Update Bid");
  }
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

  const heading = document.getElementById("bidFormHeading");
  const saveButton = document.getElementById("saveBidButton");

  if (heading) heading.textContent = "Edit Transportation Bid";
  if (saveButton) saveButton.textContent = "Update Bid";

  document.getElementById("cancelEditButton")?.classList.remove("hidden");
  document.getElementById("editMessage")?.classList.remove("hidden");

  document.getElementById("adminPanel")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function cancelBidEdit() {
  editingBidId = null;
  clearBidForm();

  const heading = document.getElementById("bidFormHeading");
  const saveButton = document.getElementById("saveBidButton");

  if (heading) heading.textContent = "Create Transportation Bid";
  if (saveButton) saveButton.textContent = "Post Bid";

  document.getElementById("cancelEditButton")?.classList.add("hidden");
  document.getElementById("editMessage")?.classList.add("hidden");
}

function clearBidForm() {
  [
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
  ].forEach(id => setValue(id, ""));
}

/* =========================================================
   LOAD BIDS
========================================================= */

async function loadBids() {
  const container = document.getElementById("bidsList");

  if (!container) return;

  container.innerHTML = "<p>Loading transportation bids...</p>";

  const { data: bids, error } = await supabaseClient
    .from("transportation_bids")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load bids error:", error);
    container.innerHTML =
      `<p class="error-message">${escapeHTML(error.message)}</p>`;
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

    const submissionsResult = isAdmin
      ? await getAdminSubmissions(bid.id)
      : { error: null, rows: [] };

    const lowBid = await getLowBid(
      bid.id,
      isAdmin,
      submissionsResult
    );

    const finalized = bid.status === "finalized";

    const resultHTML =
      isAdmin
        ? (
            finalized
              ? getAdminFinalizedSummary(bid, submissionsResult)
              : ""
          )
        : (
            finalized
              ? getVendorResultHTML(bid, myBid)
              : ""
          );

    const lowBidHTML = buildLowBidHTML(
      lowBid,
      isAdmin,
      Boolean(myBid),
      finalized
    );

    const card = document.createElement("article");

    card.className = "bid-card";
    card.id = `bid-card-${bid.id}`;

    card.innerHTML = `
      <div
        class="bid-header"
        data-action="toggle"
        data-bid-id="${bid.id}"
        role="button"
        tabindex="0"
      >
        <div class="bid-header-title">
          <span id="arrow-${bid.id}" class="bid-arrow">
            ${finalized ? "▶" : "▼"}
          </span>

          <h3>${escapeHTML(bid.title)}</h3>
        </div>

        ${resultHTML}
      </div>

      <div
        id="details-${bid.id}"
        class="bid-details ${finalized ? "collapsed" : "expanded"}"
      >
        <p>
          <strong>Description:</strong>
          ${escapeHTML(bid.description || "")}
        </p>

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

        <p>
          <span class="status">
            ${escapeHTML(String(bid.status).toUpperCase())}
          </span>
        </p>

        ${lowBidHTML}
      </div>
    `;

    const details = card.querySelector(`#details-${bid.id}`);

    if (!isAdmin && !finalized && details) {
      details.insertAdjacentHTML(
        "beforeend",
        vendorBidHTML(bid, myBid)
      );
    }

    if (isAdmin && details) {
      details.insertAdjacentHTML(
        "beforeend",
        adminBidHTML(bid, submissionsResult)
      );
    }

    container.appendChild(card);
  }
}

/* =========================================================
   BID LIST CLICK HANDLER
========================================================= */

async function handleBidListClick(event) {
  const actionElement = event.target.closest("[data-action]");

  if (!actionElement) return;

  const action = actionElement.dataset.action;
  const bidId = Number(actionElement.dataset.bidId);
  const submissionId = Number(actionElement.dataset.submissionId);

  switch (action) {
    case "toggle":
      toggleBid(bidId);
      break;

    case "submit-bid":
      await submitBid(bidId);
      break;

    case "edit-bid":
      await editBid(bidId);
      break;

    case "close-bid":
      await closeBid(bidId);
      break;

    case "finalize-bid":
      await finalizeBid(bidId);
      break;

    case "delete-bid":
      await deleteBid(bidId);
      break;

    case "award-bid":
      await awardBid(bidId, submissionId);
      break;
  }
}

function toggleBid(bidId) {
  const details = document.getElementById(`details-${bidId}`);
  const arrow = document.getElementById(`arrow-${bidId}`);

  if (!details) return;

  const opening = details.classList.contains("collapsed");

  details.classList.toggle("collapsed", !opening);
  details.classList.toggle("expanded", opening);

  if (arrow) {
    arrow.textContent = opening ? "▼" : "▶";
  }
}

/* =========================================================
   BID DATA
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
    console.error("My bid error:", error);
    return null;
  }

  return data;
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
      vendor:profiles!bid_submissions_vendor_profile_fk (
        email,
        vendor_name
      )
    `)
    .eq("bid_id", bidId)
    .order("amount", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Admin submissions error:", error);

    return {
      error: error.message,
      rows: []
    };
  }

  return {
    error: null,
    rows: data || []
  };
}

async function getLowBid(bidId, isAdmin, submissionsResult) {
  /*
    Admin already has all submissions, so no RPC is needed.
  */
  if (isAdmin) {
    return submissionsResult?.rows?.[0] || null;
  }

  /*
    Vendors use the secure get_low_bid RPC.
    It should return only amount, not vendor identity.
  */
  const { data, error } = await supabaseClient.rpc("get_low_bid", {
    p_bid_id: bidId
  });

  if (error) {
    console.error("Low bid RPC error:", error);
    return null;
  }

  return Array.isArray(data)
    ? data[0] || null
    : data || null;
}

function buildLowBidHTML(lowBid, isAdmin, vendorHasBid, finalized) {
  if (isAdmin) {
    if (!lowBid) {
      return `<p class="low-bid">Current Low Bid: No bids yet</p>`;
    }

    const vendorName =
      lowBid.vendor?.vendor_name ||
      lowBid.vendor?.email ||
      lowBid.vendor_name ||
      "";

    return `
      <p class="low-bid">
        Current Low Bid:
        $${Number(lowBid.amount).toFixed(2)}
        ${vendorName ? ` - ${escapeHTML(vendorName)}` : ""}
      </p>
    `;
  }

  /*
    Vendors only see the current low amount after submitting.
  */
  if (!vendorHasBid || finalized || !lowBid) {
    return "";
  }

  return `
    <p class="low-bid">
      Current Low Bid:
      $${Number(lowBid.amount).toFixed(2)}
    </p>
  `;
}

function getVendorResultHTML(bid, myBid) {
  if (!myBid) {
    return `
      <span class="result-label result-no-bid">
        NO BID SUBMITTED
      </span>
    `;
  }

  return Number(bid.awarded_bid_id) === Number(myBid.id)
    ? `<span class="result-label result-won">WON</span>`
    : `<span class="result-label result-lost">LOST</span>`;
}

function getAdminFinalizedSummary(bid, submissionsResult) {
  const rows = submissionsResult?.rows || [];

  const winner = rows.find(
    row => Number(row.id) === Number(bid.awarded_bid_id)
  );

  if (!winner) {
    return `<div class="finalized-summary">Finalized</div>`;
  }

  const winnerName =
    winner.vendor?.vendor_name ||
    winner.vendor?.email ||
    "Unknown Vendor";

  return `
    <div class="finalized-summary">
      <span class="result-label result-won">WON</span>
      ${escapeHTML(winnerName)} |
      $${Number(winner.amount).toFixed(2)}
    </div>
  `;
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
          ? `
            <p>
              <strong>Your Current Bid:</strong>
              $${Number(myBid.amount).toFixed(2)}
            </p>
          `
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

      <textarea
        id="notes-${bid.id}"
        placeholder="Optional Notes"
      >${escapeHTML(myBid?.notes || "")}</textarea>

      <button
        type="button"
        data-action="submit-bid"
        data-bid-id="${bid.id}"
      >
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

  const amount = Number(
    document.getElementById(`amount-${bidId}`)?.value
  );

  const notes =
    document.getElementById(`notes-${bidId}`)?.value.trim() || "";

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
    console.error("Submit bid error:", error);
    alert(error.message);
    return;
  }

  alert("Your bid was saved.");
  await loadBids();
}

/* =========================================================
   ADMIN AREA
========================================================= */

function adminBidHTML(bid, submissionsResult) {
  const rows = submissionsResult?.rows || [];
  const loadError = submissionsResult?.error;

  let html = `
    <div class="admin-box">
      <h4>Admin Controls</h4>

      <div class="admin-buttons">
        <button
          type="button"
          class="warning"
          data-action="edit-bid"
          data-bid-id="${bid.id}"
        >
          Edit Bid
        </button>
  `;

  if (bid.status !== "finalized") {
    html += `
      <button
        type="button"
        class="gray"
        data-action="close-bid"
        data-bid-id="${bid.id}"
      >
        Close Bid
      </button>

      <button
        type="button"
        class="success"
        data-action="finalize-bid"
        data-bid-id="${bid.id}"
      >
        Finalize Bid
      </button>
    `;
  }

  html += `
        <button
          type="button"
          class="danger"
          data-action="delete-bid"
          data-bid-id="${bid.id}"
        >
          Delete Bid
        </button>
      </div>
  `;

  if (loadError) {
    return `
      ${html}
      <p class="error-message">
        Error loading vendor bids:
        ${escapeHTML(loadError)}
      </p>
      </div>
    `;
  }

  if (!rows.length) {
    return `
      ${html}
      <p>No vendor bids submitted yet.</p>
      </div>
    `;
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
    const isWinner =
      Number(bid.awarded_bid_id) === Number(submission.id);

    const vendorName =
      submission.vendor?.vendor_name ||
      submission.vendor?.email ||
      "Unknown Vendor";

    const vendorEmail =
      submission.vendor?.email ||
      "";

    let actionHTML;

    if (bid.status === "finalized") {
      actionHTML = isWinner
        ? `<span class="result-label result-won">WON</span>`
        : `<span class="result-label result-lost">LOST</span>`;
    } else if (isWinner) {
      actionHTML = `
        <button
          type="button"
          class="success"
          data-action="award-bid"
          data-bid-id="${bid.id}"
          data-submission-id="${submission.id}"
        >
          Selected Winner
        </button>
      `;
    } else {
      actionHTML = `
        <button
          type="button"
          data-action="award-bid"
          data-bid-id="${bid.id}"
          data-submission-id="${submission.id}"
        >
          Select
        </button>
      `;
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

  html += `
        </tbody>
      </table>
    </div>
  </div>
  `;

  return html;
}

async function awardBid(bidId, submissionId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can select a winner.");
    return;
  }

  if (!confirm("Select this vendor as the winning bidder?")) {
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
    alert(error.message);
    return;
  }

  await loadBids();
}

async function closeBid(bidId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can close bids.");
    return;
  }

  if (
    !confirm(
      "Close this bid? Vendors will no longer be able to submit or update bids."
    )
  ) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({
      status: "closed"
    })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadBids();
}

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
    alert("Select a winning vendor before finalizing the bid.");
    return;
  }

  if (!confirm("Finalize this bid? Vendors will see WON or LOST.")) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .update({
      status: "finalized"
    })
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  await loadBids();
}

async function deleteBid(bidId) {
  if (currentProfile.role !== "admin") {
    alert("Only administrators can delete bids.");
    return;
  }

  if (
    !confirm(
      "Delete this bid and all connected vendor submissions?"
    )
  ) {
    return;
  }

  const { error } = await supabaseClient
    .from("transportation_bids")
    .delete()
    .eq("id", bidId);

  if (error) {
    alert(error.message);
    return;
  }

  if (editingBidId === bidId) {
    cancelBidEdit();
  }

  await loadBids();
}

/* =========================================================
   DATE / TIME HELPERS
========================================================= */

function localInputToDate(value) {
  if (!value) return null;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0
  );

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function isoToLocalInput(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

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

  return parts.length >= 2
    ? `${pad2(parts[0])}:${pad2(parts[1])}`
    : "";
}

function formatDate(value) {
  if (!value) return "";

  const [year, month, day] =
    String(value).split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return Number.isNaN(date.getTime())
    ? escapeHTML(value)
    : date.toLocaleDateString("en-US");
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHTML(value);
  }

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

/* =========================================================
   HELPERS
========================================================= */

function valueOf(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function setValue(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.value = value || "";
  }
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function setButtonBusy(button, busy, text) {
  if (!button) return;

  button.disabled = busy;
  button.textContent = text;
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
'''

out = Path("/mnt/data/transportation_bidding_clean")
out.mkdir(exist_ok=True)
(out/"index.html").write_text(html, encoding="utf-8")
(out/"script.js").write_text(js, encoding="utf-8")

print("Created:", out/"index.html")
print("Created:", out/"script.js")
