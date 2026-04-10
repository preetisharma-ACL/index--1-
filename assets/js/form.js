let isFormSubmitted = false;
let isFormDirty = false;
async function handleFormSubmit(formId) {

  const form = document.getElementById(formId);
  if (!form) {
    console.error(`Form with ID ${formId} not found.`);
    return;
  }
  // Detect typing (dirty state)
  form.addEventListener("input", function () {
    const hasValue = Array.from(form.elements).some(
      (el) =>
        el.tagName !== "BUTTON" &&
        el.type !== "hidden" &&
        el.value &&
        el.value.trim() !== ""
    );
    isFormDirty = hasValue;
  });
  form.addEventListener("submit", async function (event) {

    event.preventDefault(); // Prevent the default form submission

    // Show waiting indicator
    Swal.fire({
      title: "Submitting...",
      text: "Please wait while we process your request.",
      icon: "info",
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Gather form data
    const name = form.querySelector('[name="form_name"]')?.value.trim() || "";
    const phone = form.querySelector('[name="form_mobile"]')?.value.trim() || "";
    const email = form.querySelector('[name="form_email"]')?.value.trim() || "";
    const city = form.querySelector('[name="form_city"]')?.value.trim() || "";
    const select = form.querySelector('[name="form_select"]')?.value.trim() || "";
    const select2 = form.querySelector('[name="form_select2"]')?.value.trim() || "";


    // Validation for missing fields
    let missingFields = [];
    if (!name) missingFields.push("Name");
    if (!phone) missingFields.push("Phone");
    if (!email) missingFields.push("Email");
    if (!city) missingFields.push("City");
    if (!select) missingFields.push("Select");
    if (!select2) missingFields.push("Select2");

    if (missingFields.length > 0) {
      Swal.close(); // Close the waiting indicator
      Swal.fire({
        title: "Missing Fields",
        text: `Please fill out the following fields: ${missingFields.join(
          ", "
        )}`,
        icon: "warning",
        confirmButtonText: "Close",
      });
      return;
    }

    // Validate phone number length
    if (!/^\d{10}$/.test(phone)) {
      Swal.close(); // Close the waiting indicator
      Swal.fire({
        title: "Invalid Phone Number",
        text: "Please enter a valid 10-digit mobile number.",
        icon: "error",
        confirmButtonText: "Close",
      });
      return;
    }

    const payload = {
      page_url: "",
      project_name: "Online MBA",
      form_name: name,
      form_mobile: phone,
      form_email: email,
      form_city: city,
      form_select: select,
      form_select2: select2,
      doc_url: document.URL,
      doc_ref: document.referrer,
    };
    console.log(payload);
    const apiUrl = "https://apiv2.aajneetiadvertising.com/lead/save";

    const requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(payload),
    };

    try {
      const response = await fetch(apiUrl, requestOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      isFormSubmitted = true;
      const data = await response.json();
      console.log("Response data:", data);

      // Redirect to thankyou.html after successful form submission
      window.location.href = "/thankyou.html";

    } catch (error) {
      console.error("Error:", error);

      // Show error popup
      Swal.fire({
        title: "Error",
        text: "There was an error submitting the form. Please try again.",
        icon: "error",
        confirmButtonText: "Close",
      });
    }
  });
}

window.addEventListener("beforeunload", function (e) {
  if (isFormDirty && !isFormSubmitted) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// Initialize forms
handleFormSubmit("ajax-header-contact"); // First form
handleFormSubmit("ajax-header-contact-2"); // second form
handleFormSubmit("ajax-header-contact-3"); // third form
handleFormSubmit("ajax-header-contact-4"); // third form


