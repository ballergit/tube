(function () {

  const root = document.documentElement;

  /* =========================
     THEME
  ========================= */

  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    root.classList.add("dark");
  }


  /* =========================
     HELPERS
  ========================= */

  function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, function (char) {

      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];

    });

  }


  /* =========================
     VIDEO CARD
  ========================= */

  function createVideoCard(video) {

    const card = document.createElement("article");

    card.className = "card";

    card.tabIndex = 0;

    card.innerHTML = `

      <div class="thumb">

        <img
          src="${escapeHTML(video.thumbnail)}"
          alt="${escapeHTML(video.title)}"
          loading="lazy"
        >

        ${
          video.preview
          ?
          `<video
            muted
            playsinline
            preload="metadata"
            src="${escapeHTML(video.preview)}"
          ></video>`
          :
          ""
        }

        ${
          video.preview
          ?
          `<span class="preview-label">Preview</span>`
          :
          ""
        }

      </div>

      <div class="card-body">

        <h3>
          ${escapeHTML(video.title)}
        </h3>

        <div class="meta">
          👁 ${Number(video.views).toLocaleString()} views
        </div>

      </div>

    `;


    /* Open video page */

    function openVideo() {

      window.location.href =
        "video.html?id=" +
        encodeURIComponent(video.id);

    }


    card.addEventListener("click", openVideo);


    card.addEventListener("keydown", function (event) {

      if (event.key === "Enter" || event.key === " ") {

        event.preventDefault();

        openVideo();

      }

    });


    /* =========================
       DESKTOP PREVIEW
    ========================= */

    let previewTimer;

    function startPreview() {

      if (!video.preview) {
        return;
      }

      previewTimer = setTimeout(function () {

        card.classList.add("is-previewing");

        const preview =
          card.querySelector("video");

        if (preview) {

          preview.currentTime = 0;

          preview.play().catch(function () {});

        }

      }, 500);

    }


    function stopPreview() {

      clearTimeout(previewTimer);

      card.classList.remove("is-previewing");

      const preview =
        card.querySelector("video");

      if (preview) {

        preview.pause();

        preview.currentTime = 0;

      }

    }


    card.addEventListener(
      "mouseenter",
      startPreview
    );

    card.addEventListener(
      "mouseleave",
      stopPreview
    );


    /* =========================
       MOBILE PRESS & HOLD
    ========================= */

    card.addEventListener(
      "touchstart",
      startPreview,
      { passive: true }
    );

    card.addEventListener(
      "touchend",
      stopPreview,
      { passive: true }
    );

    card.addEventListener(
      "touchcancel",
      stopPreview,
      { passive: true }
    );


    return card;

  }


  /* =========================
     RENDER VIDEOS
  ========================= */

  function renderVideos(videos, container) {

    container.innerHTML = "";

    videos.forEach(function (video) {

      container.appendChild(
        createVideoCard(video)
      );

    });

  }


  /* =========================
     PAGINATION
  ========================= */

  function initializePagination() {

    const grid =
      document.getElementById("video-grid");

    const pagination =
      document.getElementById("pagination");

    if (!grid || !pagination) {
      return;
    }


    const videos =
      window.TUBE_VIDEOS || [];

    const videosPerPage = 30;

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          videos.length / videosPerPage
        )
      );


    const params =
      new URLSearchParams(
        window.location.search
      );

    let currentPage =
      parseInt(
        params.get("page") || "1",
        10
      );


    currentPage =
      Math.max(
        1,
        Math.min(
          currentPage,
          totalPages
        )
      );


    function showPage(page) {

      currentPage = page;

      const start =
        (page - 1) * videosPerPage;

      const end =
        start + videosPerPage;

      const pageVideos =
        videos.slice(start, end);


      renderVideos(
        pageVideos,
        grid
      );


      const status =
        document.getElementById(
          "page-status"
        );

      if (status) {

        status.textContent =
          "Page " +
          page +
          " of " +
          totalPages;

      }


      pagination.innerHTML = "";


      /* Previous */

      const previous =
        document.createElement("button");

      previous.textContent =
        "← Previous";

      previous.disabled =
        currentPage === 1;

      previous.addEventListener(
        "click",
        function () {

          goToPage(
            currentPage - 1
          );

        }
      );

      pagination.appendChild(
        previous
      );


      /* Page numbers */

      for (
        let i = 1;
        i <= totalPages;
        i++
      ) {

        const button =
          document.createElement("button");

        button.textContent = i;

        if (i === currentPage) {

          button.classList.add(
            "active"
          );

        }

        button.addEventListener(
          "click",
          function () {

            goToPage(i);

          }
        );

        pagination.appendChild(
          button
        );

      }


      /* Next */

      const next =
        document.createElement("button");

      next.textContent =
        "Next →";

      next.disabled =
        currentPage === totalPages;

      next.addEventListener(
        "click",
        function () {

          goToPage(
            currentPage + 1
          );

        }
      );

      pagination.appendChild(
        next
      );

    }


    function goToPage(page) {

      if (
        page < 1 ||
        page > totalPages
      ) {

        return;

      }

      window.location.href =
        "?page=" + page;

    }


    showPage(currentPage);

  }


  /* =========================
     VIDEO PAGE
  ========================= */

  function initializeVideoPage() {

    const videoContainer =
      document.getElementById(
        "video-page"
      );

    if (!videoContainer) {
      return;
    }


    const videos =
      window.TUBE_VIDEOS || [];


    const params =
      new URLSearchParams(
        window.location.search
      );


    const id =
      parseInt(
        params.get("id") || "1",
        10
      );


    const video =
      videos.find(function (item) {

        return item.id === id;

      }) || videos[0];


    if (!video) {
      return;
    }


    videoContainer.innerHTML = `

      <div class="video-player">

        ${
          video.preview
          ?
          `
          <video
            controls
            playsinline
            poster="${escapeHTML(video.thumbnail)}"
            src="${escapeHTML(video.preview)}"
          ></video>
          `
          :
          `
          <div class="video-placeholder">
            Authorized video player
          </div>
          `
        }

      </div>


      <div class="video-info">

        <h1>
          ${escapeHTML(video.title)}
        </h1>


        <div class="muted">

          👁 ${Number(video.views).toLocaleString()}
          views

          ·

          ${escapeHTML(video.category)}

        </div>


        <div class="video-actions">

          <button
            class="vote-btn"
            id="like-button"
          >
            👍 Like
            <span>
              ${video.likes}
            </span>
          </button>


          <button
            class="vote-btn"
            id="dislike-button"
          >
            👎 Dislike
            <span>
              ${video.dislikes}
            </span>
          </button>

        </div>


        <div class="muted">

          Tags:
          ${video.tags
            .map(escapeHTML)
            .join(", ")}

        </div>

      </div>

    `;


    const like =
      document.getElementById(
        "like-button"
      );

    const dislike =
      document.getElementById(
        "dislike-button"
      );


    like.addEventListener(
      "click",
      function () {

        like.classList.toggle(
          "selected"
        );

        if (
          like.classList.contains(
            "selected"
          )
        ) {

          dislike.classList.remove(
            "selected"
          );

        }

      }
    );


    dislike.addEventListener(
      "click",
      function () {

        dislike.classList.toggle(
          "selected"
        );

        if (
          dislike.classList.contains(
            "selected"
          )
        ) {

          like.classList.remove(
            "selected"
          );

        }

      }
    );


    /* Trending */

    const trending =
      document.getElementById(
        "trending-grid"
      );


    if (trending) {

      const trendingVideos =
        videos
          .slice()
          .sort(function (a, b) {

            return b.views - a.views;

          })
          .slice(0, 8);


      renderVideos(
        trendingVideos,
        trending
      );

    }

  }


  /* =========================
     PAGE UI
  ========================= */

  document.addEventListener(
    "DOMContentLoaded",
    function () {


      /* Theme */

      document
        .querySelectorAll(
          "[data-theme]"
        )
        .forEach(function (button) {

          button.addEventListener(
            "click",
            function () {

              root.classList.toggle(
                "dark"
              );

              localStorage.setItem(
                "theme",
                root.classList.contains(
                  "dark"
                )
                ? "dark"
                : "light"
              );

            }
          );

        });


      /* Mobile menu */

      document
        .querySelectorAll(
          "[data-menu]"
        )
        .forEach(function (button) {

          button.addEventListener(
            "click",
            function () {

              document.body.classList.toggle(
                "menu-open"
              );

            }
          );

        });


      document
        .querySelectorAll(
          "[data-overlay]"
        )
        .forEach(function (overlay) {

          overlay.addEventListener(
            "click",
            function () {

              document.body.classList.remove(
                "menu-open"
              );

            }
          );

        });


      /* Language */

      const savedLanguage =
        localStorage.getItem(
          "lang"
        ) || "en";


      document
        .querySelectorAll(
          "[data-lang]"
        )
        .forEach(function (select) {

          select.value =
            savedLanguage;


          select.addEventListener(
            "change",
            function () {

              localStorage.setItem(
                "lang",
                select.value
              );

            }
          );

        });


      /* Active navigation */

      const page =
        location.pathname
          .split("/")
          .pop() ||
        "index.html";


      document
        .querySelectorAll(
          ".side-link"
        )
        .forEach(function (link) {

          if (
            link.getAttribute(
              "href"
            ) === page
          ) {

            link.classList.add(
              "active"
            );

          }

        });


      initializePagination();

      initializeVideoPage();

    }

  );

})();