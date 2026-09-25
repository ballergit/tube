(function () {

  const root = document.documentElement;

  const savedTheme = localStorage.getItem("theme");

  if (savedTheme === "dark") {
    root.classList.add("dark");
  }

  const savedLang = localStorage.getItem("lang") || "en";

  document.addEventListener("DOMContentLoaded", function () {

    /* =========================
       THEME
    ========================= */

    document.querySelectorAll("[data-theme]").forEach(function (button) {

      button.addEventListener("click", function () {

        root.classList.toggle("dark");

        localStorage.setItem(
          "theme",
          root.classList.contains("dark") ? "dark" : "light"
        );

      });

    });


    /* =========================
       MOBILE MENU
    ========================= */

    document.querySelectorAll("[data-menu]").forEach(function (button) {

      button.addEventListener("click", function () {

        document.body.classList.toggle("menu-open");

      });

    });


    document.querySelectorAll("[data-overlay]").forEach(function (overlay) {

      overlay.addEventListener("click", function () {

        document.body.classList.remove("menu-open");

      });

    });


    /* =========================
       LANGUAGE
    ========================= */

    document.querySelectorAll("[data-lang]").forEach(function (select) {

      select.value = savedLang;

      select.addEventListener("change", function () {

        localStorage.setItem("lang", select.value);

      });

    });


    /* =========================
       ACTIVE NAVIGATION
    ========================= */

    const currentPage =
      location.pathname.split("/").pop() || "index.html";

    document.querySelectorAll(".side-link").forEach(function (link) {

      if (link.getAttribute("href") === currentPage) {

        link.classList.add("active");

      }

    });


    /* =========================
       VIDEO DATA
    ========================= */

    const videos = Array.isArray(window.TUBE_VIDEOS)
      ? window.TUBE_VIDEOS
      : [];


    /* =========================
       CREATE VIDEO CARD
    ========================= */

    function createVideoCard(video) {

      const card = document.createElement("a");

      card.className = "card video-card";

      card.href = "video.html?id=" + encodeURIComponent(video.id);

      card.innerHTML = `
        <div class="thumb video-thumb">

          <img
            src="${video.thumbnail || "https://placehold.co/640x360?text=Tube"}"
            alt=""
            loading="lazy"
          >

          ${
            video.preview
              ? `
                <video
                  class="preview-video"
                  muted
                  playsinline
                  preload="metadata"
                ></video>
              `
              : ""
          }

        </div>

        <div class="card-body">

          <h3>${escapeHTML(video.title || "Untitled Video")}</h3>

          <div class="muted">
            ${formatViews(video.views || 0)} views
          </div>

        </div>
      `;


      /* =========================
         DESKTOP HOVER PREVIEW
      ========================= */

      const preview = card.querySelector(".preview-video");

      let previewTimer = null;
      let longPressTriggered = false;


      if (preview && video.preview) {

        preview.src = video.preview;


        card.addEventListener("mouseenter", function () {

          previewTimer = setTimeout(function () {

            preview.play().catch(function () {});

          }, 500);

        });


        card.addEventListener("mouseleave", function () {

          clearTimeout(previewTimer);

          preview.pause();
          preview.currentTime = 0;

        });


        /* =========================
           MOBILE PRESS AND HOLD
        ========================= */

        let touchTimer = null;

        card.addEventListener(
          "touchstart",
          function () {

            longPressTriggered = false;

            touchTimer = setTimeout(function () {

              longPressTriggered = true;

              preview.play().catch(function () {});

            }, 500);

          },
          { passive: true }
        );


        card.addEventListener(
          "touchend",
          function () {

            clearTimeout(touchTimer);

            preview.pause();
            preview.currentTime = 0;

          },
          { passive: true }
        );


        card.addEventListener(
          "touchcancel",
          function () {

            clearTimeout(touchTimer);

            preview.pause();
            preview.currentTime = 0;

          },
          { passive: true }
        );


        card.addEventListener("click", function (event) {

          if (longPressTriggered) {

            event.preventDefault();

            longPressTriggered = false;

          }

        });

      }

      return card;

    }


    /* =========================
       HOME PAGE
    ========================= */

    const videoGrid = document.getElementById("videoGrid");

    if (videoGrid) {

      const perPage = 30;

      const pagination = document.getElementById("pagination");

      let currentPageNumber = 1;

      const totalPages = Math.max(
        1,
        Math.ceil(videos.length / perPage)
      );


      function renderPage(page) {

        currentPageNumber = page;

        videoGrid.innerHTML = "";

        const start = (page - 1) * perPage;

        const end = start + perPage;

        const pageVideos = videos.slice(start, end);


        if (pageVideos.length === 0) {

          videoGrid.innerHTML = `
            <p class="muted">
              No videos available yet.
            </p>
          `;

        } else {

          pageVideos.forEach(function (video) {

            videoGrid.appendChild(
              createVideoCard(video)
            );

          });

        }


        renderPagination();

      }


      function renderPagination() {

        if (!pagination) return;

        pagination.innerHTML = "";


        if (totalPages <= 1) return;


        const previous = document.createElement("button");

        previous.className = "btn";

        previous.textContent = "Previous";

        previous.disabled = currentPageNumber === 1;


        previous.addEventListener("click", function () {

          if (currentPageNumber > 1) {

            renderPage(currentPageNumber - 1);

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });

          }

        });


        pagination.appendChild(previous);


        for (
          let page = 1;
          page <= totalPages;
          page++
        ) {

          const button = document.createElement("button");

          button.className =
            "btn " +
            (page === currentPageNumber
              ? "primary"
              : "");

          button.textContent = page;


          button.addEventListener("click", function () {

            renderPage(page);

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });

          });


          pagination.appendChild(button);

        }


        const next = document.createElement("button");

        next.className = "btn";

        next.textContent = "Next";

        next.disabled =
          currentPageNumber === totalPages;


        next.addEventListener("click", function () {

          if (currentPageNumber < totalPages) {

            renderPage(currentPageNumber + 1);

            window.scrollTo({
              top: 0,
              behavior: "smooth"
            });

          }

        });


        pagination.appendChild(next);

      }


      renderPage(1);

    }


    /* =========================
       VIDEO PAGE
    ========================= */

    const mainVideo = document.getElementById("mainVideo");


    if (mainVideo) {

      const params = new URLSearchParams(
        window.location.search
      );

      const videoId = params.get("id");


      const video = videos.find(function (item) {

        return String(item.id) === String(videoId);

      });


      if (!video) {

        document.getElementById("videoTitle").textContent =
          "Video not found";

        mainVideo.style.display = "none";

        return;

      }


      /* =========================
         VIDEO PLAYER
      ========================= */

      if (video.video) {

        mainVideo.src = video.video;

      } else if (video.preview) {

        mainVideo.src = video.preview;

      }


      /* =========================
         VIDEO INFORMATION
      ========================= */

      document.getElementById("videoTitle").textContent =
        video.title || "Untitled Video";


      document.getElementById("videoViews").textContent =
        formatViews(video.views || 0) + " views";


      document.getElementById("videoCategory").textContent =
        video.category || "Uncategorized";


      /* =========================
         DOWNLOAD BUTTON
      ========================= */

      const downloadButton =
        document.getElementById("downloadBtn");


      if (downloadButton) {

        if (video.download) {

          downloadButton.href = video.download;

          downloadButton.setAttribute(
            "download",
            ""
          );

          downloadButton.style.display =
            "inline-flex";

        } else if (video.video) {

          downloadButton.href = video.video;

          downloadButton.setAttribute(
            "download",
            ""
          );

          downloadButton.style.display =
            "inline-flex";

        } else {

          downloadButton.style.display =
            "none";

        }

      }


      /* =========================
         TAGS
      ========================= */

      const tagsContainer =
        document.getElementById("videoTags");


      if (tagsContainer) {

        tagsContainer.innerHTML = "";

        if (Array.isArray(video.tags)) {

          video.tags.forEach(function (tag) {

            const tagElement =
              document.createElement("span");

            tagElement.className = "tag";

            tagElement.textContent =
              "#" + tag;

            tagsContainer.appendChild(
              tagElement
            );

          });

        }

      }


      /* =========================
         LIKE / DISLIKE
      ========================= */

      const likeButton =
        document.getElementById("likeBtn");

      const dislikeButton =
        document.getElementById("dislikeBtn");

      const likeCount =
        document.getElementById("likeCount");

      const dislikeCount =
        document.getElementById("dislikeCount");


      let liked = false;
      let disliked = false;


      let likes = Number(video.likes || 0);

      let dislikes =
        Number(video.dislikes || 0);


      function updateReactionDisplay() {

        likeCount.textContent = likes;

        dislikeCount.textContent = dislikes;


        likeButton.classList.toggle(
          "primary",
          liked
        );


        dislikeButton.classList.toggle(
          "primary",
          disliked
        );

      }


      likeButton.addEventListener(
        "click",
        function () {

          if (liked) {

            liked = false;
            likes--;

          } else {

            liked = true;

            if (disliked) {

              disliked = false;
              dislikes--;

            }

            likes++;

          }

          updateReactionDisplay();

        }
      );


      dislikeButton.addEventListener(
        "click",
        function () {

          if (disliked) {

            disliked = false;
            dislikes--;

          } else {

            disliked = true;

            if (liked) {

              liked = false;
              likes--;

            }

            dislikes++;

          }

          updateReactionDisplay();

        }
      );


      updateReactionDisplay();


      /* =========================
         TRENDING
      ========================= */

      const trendingGrid =
        document.getElementById("trendingGrid");


      if (trendingGrid) {

        const trending = videos
          .filter(function (item) {

            return String(item.id) !==
              String(video.id);

          })
          .slice()
          .sort(function (a, b) {

            return Number(b.views || 0) -
              Number(a.views || 0);

          })
          .slice(0, 10);


        trending.forEach(function (item) {

          trendingGrid.appendChild(
            createVideoCard(item)
          );

        });

      }

    }

  });


  /* =========================
     HELPERS
  ========================= */

  function formatViews(number) {

    number = Number(number || 0);

    if (number >= 1000000) {

      return (
        (number / 1000000)
          .toFixed(1)
          .replace(".0", "") +
        "M"
      );

    }


    if (number >= 1000) {

      return (
        (number / 1000)
          .toFixed(1)
          .replace(".0", "") +
        "K"
      );

    }


    return number.toString();

  }


  function escapeHTML(value) {

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }

})();