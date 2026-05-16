document.addEventListener("DOMContentLoaded", function () {

 

  const apiUrl = "https://api.aajneetiadvertising.com/lead/save";
  // New endpoints
  const sendOtpUrl = "https://testing-api.aajneetiadvertising.com/lead/sendOTP";
  const resendOtpUrl =
    "https://testing-api.aajneetiadvertising.com/lead/resendOTP";
  const verifyOtpUrl =
    "https://testing-api.aajneetiadvertising.com/lead/verifyOTP";

  let pendingFormData = null; // store data + token before/after OTP
  let firstSubmitDone = false; // track first-sheet submission after sendOTP

  // Resend timer controller
  let resendTimerInterval = null;
  // 🔥 ===== TRACKING START =====
  function getParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param) || "";
  }

  const trackingData = {
    utm_source: getParam("utm_source"),
    utm_medium: getParam("utm_medium"),
    utm_campaign: getParam("utm_campaign"),
    utm_content: getParam("utm_content"),
    utm_term: getParam("utm_term"),
    gclid: getParam("gclid"),
    fbclid: getParam("fbclid"),
  };

  function detectPlatform() {
    if (trackingData.gclid) return "google";
    if (trackingData.fbclid) return "facebook";
    return trackingData.utm_source || "unknown";
  }
  // 🔥 ===== TRACKING END =====

  // small helper for showing Swal
  function showSwal(title, text, icon = "info", timer = null) {
    const opts = { title, text, icon, confirmButtonText: "Close" };
    if (timer) opts.timer = timer;
    Swal.fire(opts);
  }

  // Create or reuse resend elements inside OTP modal; returns { btn, timerEl } or null
  function ensureResendElements() {
    const otpForm = document.querySelector("#modal14 form");
    if (!otpForm) return null;

    // if IDs already exist in the DOM, reuse them
    const existingBtn = otpForm.querySelector("#resendOtpBtn");
    const existingTimer = otpForm.querySelector("#resendTimer");
    if (existingBtn && existingTimer) {
      return { btn: existingBtn, timerEl: existingTimer };
    }

    // if a container was previously inserted by script, reuse it
    let container = otpForm.querySelector(".resend-container");
    if (container) {
      const btn = container.querySelector("#resendOtpBtn");
      const timerEl = container.querySelector("#resendTimer");
      if (btn && timerEl) return { btn, timerEl };
    }

    // Otherwise create the container + elements (will not duplicate if IDs already present)
    container = document.createElement("div");
    container.className = "form-row resend-container";
    container.style =
      "margin-top:8px; margin-bottom:6px; display:flex; justify-content:center; gap:8px; align-items:center;";

    const holder = document.createElement("div");
    holder.className = "form-holder";
    holder.style =
      "display:flex; justify-content:center; gap:8px; align-items:center;";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "resendOtpBtn";
    btn.className = "submit_button";
    btn.disabled = true;
    btn.style.padding = "6px 10px";
    btn.textContent = "Resend OTP";

    const timerEl = document.createElement("span");
    timerEl.id = "resendTimer";
    timerEl.style.fontSize = "13px";
    timerEl.style.color = "#666";
    timerEl.textContent = "Resend in 30s";

    holder.appendChild(btn);
    holder.appendChild(timerEl);
    container.appendChild(holder);

    // insert before submit row if present, else append to form
    const submitRow = Array.from(otpForm.querySelectorAll(".form-row")).find(
      (r) => r.querySelector(".form_btn"),
    );
    if (submitRow) {
      submitRow.parentNode.insertBefore(container, submitRow);
    } else {
      otpForm.appendChild(container);
    }

    return { btn, timerEl };
  }

  // start a countdown (seconds) disabling resend until end
  function startResendTimer(seconds = 30) {
    const elements = ensureResendElements();
    if (!elements) return;
    const { btn, timerEl } = elements;

    // reset previous
    stopResendTimer();
    btn.disabled = true;
    btn.classList.add("disabled");
    let remaining = seconds;
    timerEl.textContent = `Resend in ${remaining}s`;

    resendTimerInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stopResendTimer();
        enableResend();
      } else {
        timerEl.textContent = `Resend in ${remaining}s`;
      }
    }, 1000);
  }

  function stopResendTimer() {
    if (resendTimerInterval) {
      clearInterval(resendTimerInterval);
      resendTimerInterval = null;
    }
  }

  function enableResend() {
    const elements = ensureResendElements();
    if (!elements) return;
    const { btn, timerEl } = elements;
    btn.disabled = false;
    btn.classList.remove("disabled");
    timerEl.textContent = "Didn't receive? Tap Resend";
  }

  function disableResendImmediate() {
    const elements = ensureResendElements();
    if (!elements) return;
    const { btn, timerEl } = elements;
    stopResendTimer();
    btn.disabled = true;
    btn.classList.add("disabled");
    timerEl.textContent = "Resending...";
  }

  // Send OTP with full form payload: returns { ok, token, raw }
  async function sendOTP(payload) {
   

    try {
      const resp = await fetch(sendOtpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`sendOTP failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      const token = data.token || (data.data && data.data.token) || null;
      return { ok: !!token, token, raw: data };
    } catch (err) {
      console.error("sendOTP error:", err);
      return { ok: false, error: err.message || String(err) };
    }
  }

  // Resend OTP using token: returns { ok, raw }
  async function resendOTP(token) {
   
    try {
      const resp = await fetch(resendOtpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`resendOTP failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      return { ok: true, raw: data };
    } catch (err) {
      console.error("resendOTP error:", err);
      return { ok: false, error: err.message || String(err) };
    }
  }

  // Verify OTP using token+otp: returns { ok, raw }
  async function verifyOTP(token, otp) {
   

    try {
      const resp = await fetch(verifyOtpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, otp }),
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(`verifyOTP failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      // interpret success in various possible forms
      const success =
        data.success === true ||
        data.status === "success" ||
        data === true ||
        (data.data &&
          (data.data.verified === true || data.data.success === true));
      return { ok: !!success, raw: data };
    } catch (err) {
      console.error("verifyOTP error:", err);
      return { ok: false, error: err.message || String(err) };
    }
  }

  // Submit lead to your apiUrl — improved to return status + body for debugging
  async function submitLeadToApi(payload) {
    try {
      const resp = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const bodyText = await resp.text().catch(() => "");
      let bodyJson = null;
      try {
        bodyJson = bodyText ? JSON.parse(bodyText) : null;
      } catch (e) { }

      if (!resp.ok) {
        return {
          ok: false,
          status: resp.status,
          bodyText,
          bodyJson,
          error: `HTTP ${resp.status}`,
        };
      }
      return { ok: true, status: resp.status, bodyText, bodyJson };
    } catch (err) {
      console.error("submitLeadToApi error:", err);
      return { ok: false, error: err.message || String(err) };
    }
  }

  // Wire resend button click handler (safe to call multiple times)
  function wireResendButton() {
    const elements = ensureResendElements();
    if (!elements) return;
    const { btn } = elements;

    // remove previous handler by replacing onclick (safe) — avoids duplicate handlers
    btn.onclick = async function () {
      if (!pendingFormData || !pendingFormData.token) {
        showSwal("Error", "No OTP token found to resend.", "error");
        return;
      }
      disableResendImmediate();
      Swal.fire({
        title: "Resending OTP...",
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      try {
        const r = await resendOTP(pendingFormData.token);
        Swal.close();
        if (r.ok) {
          showSwal(
            "OTP Sent",
            "OTP has been resent to the mobile number.",
            "success",
            2000,
          );
          // restart the timer
          startResendTimer(30);
        } else {
          showSwal("Resend Failed", r.error || "Could not resend OTP", "error");
          // allow a short retry
          startResendTimer(10);
        }
      } catch (err) {
        Swal.close();
        console.error("Resend OTP exception:", err);
        showSwal("Error", "Unexpected error while resending OTP", "error");
        startResendTimer(10);
      }
    };
  }

  // handle form submission (sendOTP + initial lead submit)
  async function handleFormSubmit(formId) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async function (event) {
      event.preventDefault();

      // Show loader
      Swal.fire({
        title: "Validating...",
        text: "Please wait while we verify your details.",
        icon: "info",
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Collect fields
      const name = form.querySelector('[name="name1"]')?.value.trim() || "";
      const phone = form.querySelector('[name="phone"]')?.value.trim() || "";
      const city = form.querySelector('[name="City"]')?.value.trim() || "";
      const ef_email =
        form.querySelector('[name="ef_email"]')?.value.trim() || "";
      const ef_program =
        form.querySelector('[name="ef_program"]')?.value.trim() || "";
      const ef_university =
        form.querySelector('[name="ef_university"]')?.value.trim() || "";



      // Validate
      const missing = [];
      if (!name) missing.push("Name");
      if (!phone) missing.push("Phone");
      if (!city) missing.push("City");
      if (!ef_email) missing.push("ef_email");
      if (!ef_program) missing.push("ef_program");
      if (!ef_university) missing.push("ef_university");
      if (missing.length > 0) {
        Swal.close();
        Swal.fire({
          title: "Missing Fields",
          text: `Please fill out: ${missing.join(", ")}`,
          icon: "warning",
          confirmButtonText: "Close",
        });
        return;
      }

      if (!/^\d{10}$/.test(phone)) {
        Swal.close();
        Swal.fire({
          title: "Invalid Phone Number",
          text: "Please enter a valid 10-digit number.",
          icon: "error",
          confirmButtonText: "Close",
        });
        return;
      }

      Swal.close();

      // Close any currently open modals and cleanup backdrops
      document.querySelectorAll(".modal.show").forEach((m) => {
        const instance = bootstrap.Modal.getInstance(m);
        if (instance) instance.hide();
      });
      document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
      document.body.classList.remove("modal-open");
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";

      // Build payload for sendOTP (includes all form fields)
      const sendPayload = {
        page_url: window.location.href,
        project_name: "nmimsmbacode",
        name,
        mobile: phone,
        city,
        ef_email,
        ef_program,
        doc_url: document.URL,
        doc_ref: document.referrer,
        // 🔥 TRACKING
        ef_utm_source: trackingData.utm_source,
        ef_utm_medium: trackingData.utm_medium,
        ef_utm_campaign: trackingData.utm_campaign,
        ef_utm_content: trackingData.utm_content,
        ef_utm_term: trackingData.utm_term,
        ef_gclid: trackingData.gclid,
        ef_fbclid: trackingData.fbclid,
        ef_platform: detectPlatform(),
        ef_lp_name: window.location.pathname
      };

      // Show sending OTP loader
      Swal.fire({
        title: "Sending OTP...",
        text: "Please wait while we send an OTP to your mobile.",
        icon: "info",
        showConfirmButton: false,
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // Call sendOTP
      const sendResult = await sendOTP(sendPayload);
      if (!sendResult.ok) {
        Swal.close();
        // Even if sendOTP fails, requirement says "form must get submitted if otp is submitted or not"
        // so we still attempt to submit the lead once (without token) to the sheet.
        const fallbackPayload = { ...sendPayload };
        const fallbackSubmit = await submitLeadToApi(fallbackPayload);
        if (fallbackSubmit.ok) {
          showSwal(
            "Submitted",
            "Your details were submitted (OTP not sent).",
            "success",
            2500,
          );
        } else {
          showSwal(
            "Error",
            `Could not send OTP and lead submission failed: ${sendResult.error}`,
            "error",
          );
        }
        return;
      }

      // Save pending data and token
      pendingFormData = {
        ...sendPayload,
        token: sendResult.token,
      };
      // After first sendOTP call, **submit lead once** to the sheet (first time)
      const firstSubmitPayload = { ...sendPayload }; // no token appended
      const firstSubmit = await submitLeadToApi(firstSubmitPayload);
      firstSubmitDone = !!firstSubmit.ok;
      Swal.close();

      // Show PARTIAL SUCCESS (user still needs OTP to verify)
      Swal.fire({
        title: "Check WhatsApp for OTP",
        html: `
          <div style="font-size:16px; line-height:1.5;">
            Thank you for showing interest in our project! <br>
            <strong>We’ve sent a One-Time Password (OTP)</strong> to your registered mobile number 
            via WhatsApp. <br><br>
            <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" 
                alt="WhatsApp" width="50" height="50" style="vertical-align:middle;">
          </div>
        `,
        icon: "success",
        showConfirmButton: false,
        timer: 3500,
      });

      // Show OTP modal (backdrop static)
      const otpModalEl = document.getElementById("modal14");
      const otpModal = new bootstrap.Modal(otpModalEl, {
        backdrop: "static",
        keyboard: false,
      });

      // ensure resend UI exists and wire button
      ensureResendElements();
      wireResendButton();
      // start initial resend countdown
      startResendTimer(30);

      otpModal.show();
    });
  }

  // initialize forms
  ["ajax-header-contact", "ajax-header-contact-2", "ajax-header-contact-3", "ajax-header-contact-4"].forEach(handleFormSubmit);

  // Handle OTP form submission (verify + second sheet submit with OTP_ prefix)
  const otpForm = document.querySelector("#modal14 form");
  if (otpForm) {
    otpForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const otp = otpForm.querySelector('[name="otp"]').value.trim();
      if (!otp) {
        Swal.fire({
          title: "Missing OTP",
          text: "Please enter the OTP before submitting.",
          icon: "warning",
        });
        return;
      }
      if (!/^\d{4,6}$/.test(otp)) {
        Swal.fire({
          title: "Invalid OTP",
          text: "Please enter a valid 4–6 digit OTP.",
          icon: "error",
        });
        return;
      }
      if (!pendingFormData || !pendingFormData.token) {
        Swal.fire({
          title: "Error",
          text: "No form data found. Please fill the form again.",
          icon: "error",
        });
        return;
      }

      // Close OTP modal for UX
      const otpModalEl = document.getElementById("modal14");
      const otpModalInstance = bootstrap.Modal.getInstance(otpModalEl);
      if (otpModalInstance) otpModalInstance.hide();

      // cleanup backdrops after short delay
      setTimeout(() => {
        document
          .querySelectorAll(".modal-backdrop")
          .forEach((el) => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.overflow = "";
        document.body.style.paddingRight = "";
      }, 200);

      // Show verifying loader
      Swal.fire({
        title: "Verifying OTP...",
        text: "Please wait...",
        icon: "info",
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      // Call verifyOTP
      const verifyRes = await verifyOTP(pendingFormData.token, otp);
      Swal.close();

      if (!verifyRes.ok) {

        Swal.fire({
          title: "OTP Verification Failed",
          text: verifyRes.error || "Incorrect OTP. Please try again.",
          icon: "error",
          confirmButtonText: "Retry",
        }).then(() => {

          const otpModalEl2 = document.getElementById("modal14");

          const otpModal2 = new bootstrap.Modal(otpModalEl2, {
            backdrop: "static",
            keyboard: false,
          });

          ensureResendElements();
          wireResendButton();
          startResendTimer(30);

          otpModal2.show();
        });

        return;
      }
      // Save verified lead
      const verifiedPayload = {
        page_url: pendingFormData.page_url || window.location.href,
        project_name: pendingFormData.project_name || "nmimsmbacode",

        name: `OTP_${pendingFormData.name}`,

        mobile: pendingFormData.mobile,

        city: pendingFormData.city,

        otp_token: pendingFormData.token,

        otp_verified: true,
      };

      Swal.fire({
        title: "Submitting Verified Data...",
        text: "Saving verified entry...",
        icon: "info",
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });

      const secondSubmit = await submitLeadToApi(verifiedPayload);

      Swal.close();

      // SUCCESS
      // Swal.fire({
      //   title: "Verified",
      //   text: "OTP verified successfully.",
      //   icon: "success",
      //   timer: 2000,
      //   showConfirmButton: false,
      // });
      if (secondSubmit.ok) {
        Swal.fire({
          title: "Verified",
          text: "OTP verified and data saved (marked as OTP_).",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
        // redirect after short delay so user sees the success toast
        setTimeout(() => {
          window.location.href = "/thankyou.html";
        }, 1400);
      } else {
        // detect duplicate/already-submitted message
        const msgCandidates = [
          secondSubmit.bodyJson &&
          (secondSubmit.bodyJson.msg ||
            secondSubmit.bodyJson.message ||
            secondSubmit.bodyJson.error),
          secondSubmit.bodyText,
          secondSubmit.error,
        ]
          .filter(Boolean)
          .map((s) => String(s).toLowerCase());

        const duplicateDetected =
          msgCandidates.some(
            (s) =>
              s.includes("already") &&
              (s.includes("submit") ||
                s.includes("submitted") ||
                s.includes("contact")),
          ) || secondSubmit.status === 409;

        if (duplicateDetected) {
          // Treat duplicate as success for UX
          Swal.fire({
            title: "Verified",
            text: "OTP verified â€” your contact is already saved.",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
          });
          console.info(
            "Duplicate detected on verified save; treated as success:",
            secondSubmit,
          );
          // redirect as well
          setTimeout(() => {
            window.location.href = "/thankyou.html";
          }, 1400);
        } else {
          // Show a helpful Partial / error message with server text
          const serverMsg =
            (secondSubmit.bodyJson &&
              (secondSubmit.bodyJson.message ||
                secondSubmit.bodyJson.error ||
                JSON.stringify(secondSubmit.bodyJson))) ||
            secondSubmit.bodyText ||
            secondSubmit.error ||
            `HTTP ${secondSubmit.status || "?"}`;
          Swal.fire({
            title: "Partial Success",
            html: `OTP verified but saving verified data failed.<br><strong>Server:</strong> ${serverMsg}`,
            icon: "warning",
            footer: "See console/network for details.",
          });
          console.error("Verified lead save failed:", secondSubmit);
        }
      }

      // Clear pending data after processing
      pendingFormData = null;
      firstSubmitDone = false;
      // cleanup timer/UI
      stopResendTimer();
      const elements = ensureResendElements();
      if (elements && elements.btn) elements.btn.disabled = true;
      if (elements && elements.timerEl) elements.timerEl.textContent = "";
    });
  } else {
    console.warn("OTP modal form (#modal14 form) not found on page.");
  }
  // Expose resend function (in case you want to call programmatically)
  window.__Aajneeti = {
    resendOTP: async () => {
      if (!pendingFormData || !pendingFormData.token) {
        showSwal("Error", "No OTP token available to resend.", "error");
        return { ok: false, error: "no token" };
      }
      disableResendImmediate();
      Swal.fire({
        title: "Resending OTP...",
        showConfirmButton: false,
        didOpen: () => Swal.showLoading(),
      });
      const r = await resendOTP(pendingFormData.token);
      Swal.close();
      if (r.ok) {
        showSwal("OTP Sent", "OTP has been resent.", "success", 2000);
        startResendTimer(30);
      } else {
        showSwal("Resend Failed", r.error || "Could not resend OTP", "error");
        startResendTimer(10);
      }
      return r;
    },
  };
});
