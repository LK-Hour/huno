/* ===== Huno Landing Page — interactions ===== */

/* ---------- Mobile nav toggle ---------- */
(function () {
  var toggle = document.getElementById("navToggle");
  var nav = document.getElementById("siteNav");
  var actions = document.querySelector(".nav-actions");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", function () {
    var open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    nav.classList.toggle("open", !open);
    if (actions) actions.classList.toggle("open", !open);
  });

  // Close the menu when a link inside it is clicked
  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      toggle.setAttribute("aria-expanded", "false");
      nav.classList.remove("open");
      if (actions) actions.classList.remove("open");
    });
  });
})();

/* ---------- Scroll reveal ---------- */
(function () {
  var items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  if (!("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("in"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach(function (el) { observer.observe(el); });
})();

/* ---------- Copy buttons ---------- */
(function () {
  function fallbackCopy(el, text) {
    var done = function () {
      var original = el.textContent;
      el.textContent = "Copied ✓";
      setTimeout(function () { el.textContent = original; }, 1600);
    };

    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "absolute";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      var ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) done();
    } catch (e) {
      document.body.removeChild(textarea);
      done();
    }
  }

  function copyText(el, text) {
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      fallbackCopy(el, text);
      return;
    }
    navigator.clipboard.writeText(text).then(
      function () {
        // Handle both .copy-btn and span.btn-copy (which may contain extra text)
        var labelled = el.closest(".install-row")
          ? el
          : el.closest(".tree-note")
            ? el.parentNode.querySelector("code")
            : null;

        if (labelled && labelled !== el) {
          var original = labelled.textContent;
          labelled.textContent = "Copied ✓  " + original;
          var btnOriginal = el.textContent;
          el.textContent = "copied ✓";
          setTimeout(function () {
            if (labelled) labelled.textContent = original;
            el.textContent = btnOriginal;
          }, 1600);
        } else {
          var original2 = el.textContent;
          el.textContent = "Copied ✓";
          setTimeout(function () { el.textContent = original2; }, 1600);
        }
      },
      function () { fallbackCopy(el, text); }
    );
  }

  var buttons = document.querySelectorAll("[data-copy], .copy-btn");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var text = btn.getAttribute("data-copy") || btn.textContent.trim().replace(/^Copy\s*/, "");
      copyText(btn, text);
    });
  });
})();