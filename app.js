/* =========================================================
   VEXA APP.JS
   ========================================================= */

const VEXA_LOCAL = window.VEXA_VIDEOS || [];
const PAGE_SIZE = 30;

let allVideos = [];
let currentPage = 1;
let currentList = [];


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    setupTheme();
    setupMenu();
    setupSearch();

    /*
     * My Profile
     */
    if (document.getElementById("profilePage")) {
        await renderMyProfile();
        return;
    }

    /*
     * Tags
     */
    if (document.getElementById("tagCloud")) {
        await loadTags();
        return;
    }

    /*
     * Creator page
     */
    if (document.getElementById("creatorPage")) {
        await renderCreatorPage();
        return;
    }

    /*
     * Video page
     */
    if (document.getElementById("videoPage")) {
        await renderVideoPage();
        return;
    }

    /*
     * Video listing
     */
    if (document.getElementById("videoGrid")) {
        await loadListing();
    }

});


/* =========================================================
   THEME
   ========================================================= */

function setupTheme() {

    const saved =
        localStorage.getItem("vexa-theme");

    document.documentElement.classList.toggle(
        "light",
        saved === "light"
    );

    const button =
        document.getElementById("themeBtn");

    if (!button) return;

    button.onclick = () => {

        const light =
            !document.documentElement.classList.contains(
                "light"
            );

        document.documentElement.classList.toggle(
            "light",
            light
        );

        localStorage.setItem(
            "vexa-theme",
            light ? "light" : "dark"
        );
    };
}


/* =========================================================
   HAMBURGER MENU
   ========================================================= */

function setupMenu() {

    const button =
        document.getElementById("menuBtn");

    const overlay =
        document.getElementById("overlay");

    if (button) {

        button.onclick = () => {

            document.body.classList.toggle(
                "menu-open"
            );

        };

    }

    if (overlay) {

        overlay.onclick = () => {

            document.body.classList.remove(
                "menu-open"
            );

        };

    }

    document
        .querySelectorAll(".sidebar a")
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {
                    document.body.classList.remove(
                        "menu-open"
                    );
                }
            );

        });
}


/* =========================================================
   SEARCH
   ========================================================= */

function setupSearch() {

    const input =
        document.getElementById("searchInput");

    if (!input) return;

    input.addEventListener(
        "input",
        () => {

            const query =
                input.value
                    .toLowerCase()
                    .trim();

            /*
             * Tag search
             */
            if (
                document.getElementById(
                    "tagCloud"
                )
            ) {

                document
                    .querySelectorAll(
                        ".tag-link"
                    )
                    .forEach(link => {

                        link.hidden =
                            query &&
                            !link.textContent
                                .toLowerCase()
                                .includes(query);

                    });

                return;
            }

            if (!allVideos.length) return;

            currentPage = 1;

            const filtered =
                query
                    ? allVideos.filter(video => {

                        const text =
                            (
                                video.title +
                                " " +
                                (video.category || "") +
                                " " +
                                (
                                    video.tags || []
                                ).join(" ")
                            )
                            .toLowerCase();

                        return text.includes(query);

                    })
                    : allVideos;

            renderGrid(filtered);

        }
    );
}


/* =========================================================
   LOAD VIDEOS
   ========================================================= */

async function loadListing() {

    allVideos = VEXA_LOCAL;

    if (window.supabaseClient) {

        const {
            data,
            error
        } =
            await window.supabaseClient
                .from(
                    "vexa_published_videos"
                )
                .select("*")
                .limit(300);

        if (
            !error &&
            data &&
            data.length
        ) {

            allVideos =
                data.map(normalizeVideo);

        }

    }

    renderGrid(allVideos);
}


/* =========================================================
   NORMALIZE VIDEO
   ========================================================= */

function normalizeVideo(v) {

    return {
        ...v,

        thumbnail:
            v.thumbnail_url ||
            v.thumbnail ||
            "https://placehold.co/640x360/111/fff?text=Vexa",

        video:
            v.video_url ||
            v.video,

        preview:
            v.preview_url ||
            v.preview,

        download:
            v.video_url ||
            v.download,

        category:
            v.category ||
            "Video",

        tags:
            Array.isArray(v.tags)
                ? v.tags
                : [],

        uploader_id:
            v.uploader_id ||
            v.user_id ||
            v.created_by,

        uploader_name:
            v.uploader_name ||
            v.creator_name ||
            v.username ||
            "Vexa Creator"
    };
}


/* =========================================================
   VIDEO GRID
   ========================================================= */

function renderGrid(
    list = allVideos
) {

    currentList = list;

    const grid =
        document.getElementById(
            "videoGrid"
        );

    if (!grid) return;

    const total =
        Math.max(
            1,
            Math.ceil(
                list.length / PAGE_SIZE
            )
        );

    currentPage =
        Math.min(
            currentPage,
            total
        );

    const start =
        (currentPage - 1) *
        PAGE_SIZE;

    grid.innerHTML =
        list
            .slice(
                start,
                start + PAGE_SIZE
            )
            .map(createCard)
            .join("") ||
        `
            <p class="muted">
                No videos found.
            </p>
        `;

    setupPreviews();

    renderPagination(total);
}


/* =========================================================
   VIDEO CARD
   ========================================================= */

function createCard(v) {

    const x =
        normalizeVideo(v);

    return `
        <article
            class="card video-card"
            data-id="${esc(x.id)}">

            <a
                class="video-link"
                href="video.html?id=${encodeURIComponent(x.id)}">

                <div class="thumb preview-wrap">

                    <img
                        class="thumb-img"
                        src="${esc(x.thumbnail)}"
                        alt=""
                        loading="lazy">

                    ${
                        x.preview
                            ? `
                                <video
                                    class="preview-video"
                                    muted
                                    playsinline
                                    preload="none"
                                    src="${esc(x.preview)}">
                                </video>
                            `
                            : ""
                    }

                    <span class="play">
                        ▶
                    </span>

                </div>

                <div class="card-body">

                    <h3>
                        ${esc(x.title)}
                    </h3>

                    <div class="card-meta">
                        ${formatViews(x.views || 0)}
                        views ·
                        ${esc(x.category || "Video")}
                    </div>

                </div>

            </a>

        </article>
    `;
}


/* =========================================================
   PRESS / HOLD VIDEO PREVIEW
   ========================================================= */

function setupPreviews() {

    document
        .querySelectorAll(".video-card")
        .forEach(card => {

            const video =
                card.querySelector(
                    ".preview-video"
                );

            if (!video) return;

            let timer = null;
            let previewing = false;

            const start = () => {

                clearTimeout(timer);

                timer =
                    setTimeout(
                        () => {

                            video.currentTime = 0;

                            video
                                .play()
                                .catch(() => {});

                            card.classList.add(
                                "previewing"
                            );

                            previewing = true;

                        },
                        450
                    );
            };

            const stop = () => {

                clearTimeout(timer);

                timer = null;

                video.pause();

                video.currentTime = 0;

                card.classList.remove(
                    "previewing"
                );

                previewing = false;
            };

            card.addEventListener(
                "mouseenter",
                start
            );

            card.addEventListener(
                "mouseleave",
                stop
            );

            card.addEventListener(
                "touchstart",
                start,
                {
                    passive: true
                }
            );

            card.addEventListener(
                "touchend",
                () => {

                    if (previewing) {
                        stop();
                    }

                },
                {
                    passive: true
                }
            );

            card.addEventListener(
                "touchcancel",
                stop,
                {
                    passive: true
                }
            );

        });
}


/* =========================================================
   PAGINATION
   ========================================================= */

function renderPagination(total) {

    const pagination =
        document.getElementById(
            "pagination"
        );

    if (!pagination) return;

    if (total <= 1) {

        pagination.innerHTML = "";

        return;
    }

    let html = `
        <button
            class="btn"
            ${currentPage === 1 ? "disabled" : ""}
            onclick="window.vexaPage(${currentPage - 1})">
            Previous
        </button>
    `;

    for (
        let n = 1;
        n <= total;
        n++
    ) {

        html += `
            <button
                class="btn ${
                    n === currentPage
                        ? "primary"
                        : ""
                }"
                onclick="window.vexaPage(${n})">

                ${n}

            </button>
        `;
    }

    html += `
        <button
            class="btn"
            ${
                currentPage === total
                    ? "disabled"
                    : ""
            }
            onclick="window.vexaPage(${currentPage + 1})">

            Next

        </button>
    `;

    pagination.innerHTML = html;
}


window.vexaPage = (n) => {

    currentPage =
        Math.max(
            1,
            n
        );

    renderGrid(
        currentList
    );

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};


/* =========================================================
   VIDEO PAGE
   ========================================================= */

async function renderVideoPage() {

    const box =
        document.getElementById(
            "videoPage"
        );

    const id =
        new URLSearchParams(
            location.search
        ).get("id");

    let video =
        VEXA_LOCAL.find(
            x =>
                String(x.id) ===
                String(id)
        );

    if (
        window.supabaseClient &&
        id
    ) {

        const {
            data
        } =
            await window.supabaseClient
                .from(
                    "vexa_published_videos"
                )
                .select("*")
                .eq("id", id)
                .maybeSingle();

        if (data) {
            video =
                normalizeVideo(data);
        }

    }

    if (!video) {

        box.innerHTML = `
            <div class="form">

                <h1>
                    Video not found
                </h1>

                <a
                    class="btn"
                    href="index.html">

                    Back

                </a>

            </div>
        `;

        return;
    }

    video =
        normalizeVideo(video);

    const creatorHref =
        video.uploader_id
            ? `creator.html?id=${encodeURIComponent(
                video.uploader_id
            )}`
            : "#";

    box.innerHTML = `

        <div class="player-wrap">

            <video
                class="main-player"
                controls
                playsinline
                poster="${esc(video.thumbnail)}"
                src="${esc(video.video || "")}">
            </video>

        </div>

        <div class="video-info">

            <h1>
                ${esc(video.title)}
            </h1>

            <div class="muted">

                ${formatViews(video.views || 0)}
                views ·
                ${esc(video.category || "Video")}

            </div>

            <div class="creator-line">

                Uploaded by

                <a
                    class="creator-link"
                    href="${creatorHref}">

                    ${esc(
                        video.uploader_name ||
                        "Vexa Creator"
                    )}

                </a>

            </div>

            <div class="actions">

                <button
                    class="action-btn"
                    id="likeBtn"
                    title="Like">

                    ♡
                    <span>
                        ${video.likes || 0}
                    </span>

                </button>

                <button
                    class="action-btn"
                    id="dislikeBtn"
                    title="Dislike">

                    ♧
                    <span>
                        ${video.dislikes || 0}
                    </span>

                </button>

                <a
                    class="action-btn"
                    href="${esc(
                        video.download ||
                        video.video ||
                        ""
                    )}"
                    download
                    title="Download">

                    ⇩
                    <span>
                        Download
                    </span>

                </a>

                <button
                    class="action-btn primary"
                    id="shareBtn"
                    title="Share">

                    ↗
                    <span>
                        Share
                    </span>

                </button>

            </div>

            <div class="tags">

                ${
                    (video.tags || [])
                        .map(tag => `
                            <a
                                class="tag-link"
                                href="tags.html?tag=${encodeURIComponent(tag)}">

                                #${esc(tag)}

                            </a>
                        `)
                        .join("")
                }

            </div>

            <p>
                ${esc(video.description || "")}
            </p>

        </div>


        <section class="comment-box">

            <h2>
                Comments
            </h2>

            <form
                class="comment-form"
                id="commentForm">

                <input
                    id="commentInput"
                    maxlength="1000"
                    placeholder="Add a comment..."
                    required>

                <button
                    class="btn primary">

                    Post

                </button>

            </form>

            <div
                id="commentList"
                class="comment-list">
            </div>

        </section>


        <section>

            <h2>
                Related videos
            </h2>

            <div
                class="grid"
                id="trendingGrid">
            </div>

        </section>

    `;

    setupReactions(video.id);

    setupShare(video);

    await loadComments(video.id);

    await incrementView(video.id);

    await loadTrending();
}


/* =========================================================
   VIDEO VIEW
   ========================================================= */

async function incrementView(id) {

    if (!window.supabaseClient) return;

    await window.supabaseClient.rpc(
        "record_video_view",
        {
            p_video_id: Number(id)
        }
    );
}


/* =========================================================
   LIKES / DISLIKES
   ========================================================= */

async function setupReactions(id) {

    const likeButton =
        document.getElementById(
            "likeBtn"
        );

    const dislikeButton =
        document.getElementById(
            "dislikeBtn"
        );

    if (
        !likeButton ||
        !dislikeButton
    ) {
        return;
    }

    const sendReaction =
        async reaction => {

            if (!window.supabaseClient) {

                alert(
                    "Supabase is not connected."
                );

                return;
            }

            const {
                data,
                error
            } =
                await window.supabaseClient
                    .rpc(
                        "set_video_reaction",
                        {
                            p_video_id:
                                Number(id),

                            p_reaction:
                                reaction
                        }
                    );

            if (error) {

                alert(
                    error.message
                );

                return;
            }

            likeButton
                .querySelector("span")
                .textContent =
                data.likes;

            dislikeButton
                .querySelector("span")
                .textContent =
                data.dislikes;
        };

    likeButton.onclick =
        () => sendReaction("like");

    dislikeButton.onclick =
        () => sendReaction("dislike");
}


/* =========================================================
   SHARE
   ========================================================= */

function setupShare(video) {

    const button =
        document.getElementById(
            "shareBtn"
        );

    if (!button) return;

    button.onclick =
        async () => {

            const url =
                location.href;

            if (navigator.share) {

                try {

                    await navigator.share({
                        title:
                            video.title,

                        url
                    });

                    return;

                } catch (error) {}

            }

            try {

                await navigator.clipboard
                    .writeText(url);

                alert(
                    "Link copied."
                );

            } catch (error) {

                prompt(
                    "Copy this link:",
                    url
                );

            }

        };
}


/* =========================================================
   COMMENTS
   ========================================================= */

async function loadComments(
    videoId
) {

    const list =
        document.getElementById(
            "commentList"
        );

    const form =
        document.getElementById(
            "commentForm"
        );

    if (!list) return;

    const render =
        rows => {

            list.innerHTML =
                rows?.length

                    ? rows
                        .map(comment => `
                            <article class="comment">

                                <div
                                    class="comment-head">

                                    <strong>
                                        ${esc(
                                            comment.author_name ||
                                            comment.username ||
                                            comment.guest_name ||
                                            "Guest"
                                        )}
                                    </strong>

                                    <span class="muted">

                                        ${
                                            comment.created_at
                                                ? new Date(
                                                    comment.created_at
                                                ).toLocaleDateString()
                                                : ""
                                        }

                                    </span>

                                </div>

                                <div>
                                    ${esc(
                                        comment.body ||
                                        comment.comment ||
                                        ""
                                    )}
                                </div>

                            </article>
                        `)
                        .join("")

                    : `
                        <p class="muted">
                            No comments yet.
                        </p>
                    `;
        };

    if (!window.supabaseClient) {

        render([]);

        return;
    }

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("video_comments")
            .select("*")
            .eq(
                "video_id",
                videoId
            )
            .eq(
                "status",
                "approved"
            )
            .order(
                "created_at",
                {
                    ascending: false
                }
            )
            .limit(100);

    render(
        error
            ? []
            : data
    );

    if (!form) return;

    form.onsubmit =
        async event => {

            event.preventDefault();

            const input =
                document.getElementById(
                    "commentInput"
                );

            const body =
                input.value.trim();

            if (!body) return;

            const {
                data: {
                    user
                }
            } =
                await window.supabaseClient
                    .auth
                    .getUser();

            /*
             * Registered users
             */
            if (user) {

                const {
                    error
                } =
                    await window.supabaseClient
                        .from(
                            "video_comments"
                        )
                        .insert({
                            video_id:
                                videoId,

                            user_id:
                                user.id,

                            body,

                            status:
                                "pending"
                        });

                if (error) {

                    alert(
                        error.message
                    );

                    return;
                }

                input.value = "";

                alert(
                    "Comment submitted for review."
                );

                return;
            }

            /*
             * Guest comment
             */
            const guestName =
                prompt(
                    "Enter your name:"
                );

            if (!guestName) return;

            const {
                error
            } =
                await window.supabaseClient
                    .from(
                        "video_comments"
                    )
                    .insert({
                        video_id:
                            videoId,

                        user_id:
                            null,

                        guest_name:
                            guestName.trim(),

                        body,

                        status:
                            "pending"
                    });

            if (error) {

                alert(
                    error.message
                );

                return;
            }

            input.value = "";

            alert(
                "Comment submitted for review."
            );
        };
}


/* =========================================================
   TRENDING / RELATED
   ========================================================= */

async function loadTrending() {

    const grid =
        document.getElementById(
            "trendingGrid"
        );

    if (!grid) return;

    let list =
        VEXA_LOCAL;

    if (window.supabaseClient) {

        const {
            data
        } =
            await window.supabaseClient
                .from(
                    "vexa_published_videos"
                )
                .select("*")
                .limit(8);

        if (
            data &&
            data.length
        ) {

            list =
                data.map(
                    normalizeVideo
                );

        }
    }

    grid.innerHTML =
        list
            .slice(0, 8)
            .map(createCard)
            .join("");

    setupPreviews();
}


/* =========================================================
   TAGS
   ========================================================= */

async function loadTags() {

    const cloud =
        document.getElementById(
            "tagCloud"
        );

    if (!cloud) return;

    let tags = [];

    if (window.supabaseClient) {

        const {
            data
        } =
            await window.supabaseClient
                .from(
                    "vexa_published_videos"
                )
                .select("tags")
                .limit(500);

        if (data) {

            data.forEach(video => {

                (
                    Array.isArray(video.tags)
                        ? video.tags
                        : []
                ).forEach(tag => {

                    tags.push(
                        String(tag)
                    );

                });

            });

        }
    }

    if (!tags.length) {

        VEXA_LOCAL.forEach(
            video => {

                (
                    video.tags || []
                ).forEach(tag => {

                    tags.push(
                        String(tag)
                    );

                });

            }
        );
    }

    const counts = {};

    tags.forEach(tag => {

        counts[tag] =
            (counts[tag] || 0) + 1;

    });

    const unique =
        Object.keys(counts)
            .sort(
                (a, b) =>
                    counts[b] -
                    counts[a] ||
                    a.localeCompare(b)
            );

    const selected =
        new URLSearchParams(
            location.search
        ).get("tag");

    cloud.innerHTML =
        unique
            .map(tag => `
                <a
                    class="tag-link"
                    href="videos.html?tag=${encodeURIComponent(tag)}">

                    #${esc(tag)}

                    <span class="muted">
                        ${counts[tag]}
                    </span>

                </a>
            `)
            .join("") ||

        `
            <p class="muted">
                No tags yet.
            </p>
        `;

    if (selected) {

        document
            .querySelectorAll(
                ".tag-link"
            )
            .forEach(link => {

                if (
                    link.textContent
                        .toLowerCase()
                        .includes(
                            selected.toLowerCase()
                        )
                ) {

                    link.style.background =
                        "var(--accent)";
                }

            });
    }
}


/* =========================================================
   CREATOR PAGE
   ========================================================= */

async function renderCreatorPage() {

    const box =
        document.getElementById(
            "creatorPage"
        );

    const id =
        new URLSearchParams(
            location.search
        ).get("id");

    if (!id) {

        box.innerHTML = `
            <p class="muted">
                Creator not found.
            </p>
        `;

        return;
    }

    let videos = [];

    if (window.supabaseClient) {

        const {
            data
        } =
            await window.supabaseClient
                .from("videos")
                .select("*")
                .eq(
                    "uploader_id",
                    id
                )
                .eq(
                    "status",
                    "published"
                )
                .limit(300);

        if (data) {

            videos =
                data.map(
                    normalizeVideo
                );

        }
    }

    const name =
        videos[0]?.uploader_name ||
        "Creator";

    box.innerHTML = `

        <div class="profile-head">

            <div class="avatar">

                ${esc(
                    name
                        .slice(0, 1)
                        .toUpperCase()
                )}

            </div>

            <div>

                <h1 style="margin:0">

                    ${esc(name)}

                </h1>

                <div class="muted">

                    Published content

                </div>

            </div>

        </div>

        <div
            class="grid"
            id="creatorGrid">
        </div>

    `;

    document.getElementById(
        "creatorGrid"
    ).innerHTML =

        videos
            .map(createCard)
            .join("") ||

        `
            <p class="muted">
                No published content yet.
            </p>
        `;

    setupPreviews();
}


/* =========================================================
   MY PROFILE
   ========================================================= */

async function renderMyProfile() {

    const box =
        document.getElementById(
            "profilePage"
        );

    if (!box) return;

    box.innerHTML = `
        <div class="profile-loading">
            Loading profile...
        </div>
    `;

    if (!window.supabaseClient) {

        box.innerHTML = `
            <div class="form">

                <h2>
                    Supabase is not connected.
                </h2>

            </div>
        `;

        return;
    }

    const {
        data: {
            user
        },
        error: authError
    } =
        await window.supabaseClient
            .auth
            .getUser();

    if (
        authError ||
        !user
    ) {

        box.innerHTML = `
            <div class="form">

                <h2>
                    Please log in
                </h2>

                <a
                    class="btn primary"
                    href="login.html">

                    Log In

                </a>

            </div>
        `;

        return;
    }

    /*
     * Load the actual authenticated user's profile.
     */
    const {
        data: profile,
        error
    } =
        await window.supabaseClient
            .from("profiles")
            .select(`
                id,
                username,
                display_name,
                country,
                avatar_url,
                banner_url,
                creator_verified,
                is_creator,
                bio,
                social_link
            `)
            .eq(
                "id",
                user.id
            )
            .maybeSingle();

    if (error) {

        console.error(
            "Profile error:",
            error
        );

        box.innerHTML = `
            <div class="form">

                <h2>
                    Unable to load profile
                </h2>

                <p class="muted">

                    ${esc(
                        error.message
                    )}

                </p>

            </div>
        `;

        return;
    }

    if (!profile) {

        box.innerHTML = `
            <div class="form">

                <h2>
                    Profile not found
                </h2>

                <p class="muted">

                    Your account profile
                    has not been created yet.

                </p>

            </div>
        `;

        return;
    }


    /* =====================================================
       FOLLOWER COUNT
       ===================================================== */

    let followerCount = 0;

    try {

        const {
            count
        } =
            await window.supabaseClient
                .from("follows")
                .select(
                    "*",
                    {
                        count: "exact",
                        head: true
                    }
                )
                .eq(
                    "following_id",
                    user.id
                );

        followerCount =
            count || 0;

    } catch (error) {

        followerCount = 0;

    }


    /* =====================================================
       PRIVATE ACCOUNT AGE
       ===================================================== */

    const accountCreated =
        user.created_at
            ? new Date(
                user.created_at
            )
            : null;

    const accountAge =
        accountCreated
            ? formatAccountAge(
                accountCreated
            )
            : "";


    /* =====================================================
       PROFILE DISPLAY
       ===================================================== */

    const displayName =
        profile.display_name ||
        profile.username ||
        "User";

    const username =
        profile.username ||
        "user";

    const avatar =
        profile.avatar_url ||
        `https://placehold.co/160x160/222/fff?text=${encodeURIComponent(
            displayName
                .slice(0, 1)
                .toUpperCase()
        )}`;


    /* =====================================================
       CREATOR TABS VS REGULAR USER
       ===================================================== */

    const creatorTabs =
        profile.is_creator

            ? `
                <div class="profile-tabs">

                    <button
                        class="profile-tab active"
                        data-tab="posts">

                        Posts

                    </button>

                    <button
                        class="profile-tab"
                        data-tab="comments">

                        Comments

                    </button>

                    <button
                        class="profile-tab"
                        data-tab="about">

                        About

                    </button>

                </div>
            `

            : `
                <div class="profile-tabs">

                    <button
                        class="profile-tab active"
                        data-tab="about">

                        About

                    </button>

                </div>
            `;


    box.innerHTML = `

        <section class="reddit-profile">


            <!-- COVER -->

            <div class="profile-banner">

                ${
                    profile.banner_url
                        ? `
                            <img
                                src="${esc(
                                    profile.banner_url
                                )}"
                                alt="">
                        `
                        : ""
                }

            </div>


            <div class="profile-main">


                <!-- AVATAR -->

                <div class="profile-avatar-wrap">

                    <img
                        class="profile-avatar-large"
                        src="${esc(avatar)}"
                        alt="${esc(displayName)}">

                </div>


                <!-- NAME / EDIT -->

                <div class="profile-top-row">


                    <div class="profile-name-area">

                        <h1>

                            ${esc(
                                displayName
                            )}

                        </h1>


                        <div class="profile-handle">

                            @${esc(
                                username
                            )}

                        </div>


                        ${
                            profile.creator_verified
                                ? `
                                    <span
                                        class="profile-verified">

                                        Verified Creator

                                    </span>
                                `
                                : ""
                        }

                    </div>


                    <button
                        class="btn"
                        id="editProfileBtn">

                        Edit Profile

                    </button>


                </div>


                <!-- FOLLOWERS -->

                <div class="profile-stats">

                    <div>

                        <strong>

                            ${formatViews(
                                followerCount
                            )}

                        </strong>

                        <span>
                            followers
                        </span>

                    </div>

                </div>


                <!-- BIO -->

                ${
                    profile.bio
                        ? `
                            <p
                                class="profile-bio">

                                ${esc(
                                    profile.bio
                                )}

                            </p>
                        `
                        : ""
                }


                <!-- SOCIAL LINK -->

                ${
                    profile.social_link
                        ? `
                            <a
                                class="profile-social"
                                href="${esc(
                                    profile.social_link
                                )}"
                                target="_blank"
                                rel="noopener noreferrer">

                                ${esc(
                                    profile.social_link
                                )}

                            </a>
                        `
                        : ""
                }


                <!-- TABS -->

                ${creatorTabs}


                <!-- TAB CONTENT -->

                <div
                    id="profileTabContent"
                    class="profile-tab-content">
                </div>


                <!-- PRIVATE ACCOUNT AGE -->

                <div
                    class="profile-private-info">

                    <span>

                        Account age:

                        <strong>

                            ${esc(
                                accountAge
                            )}

                        </strong>

                    </span>

                </div>


            </div>

        </section>

    `;


    /*
     * Regular users open on About.
     * Creators also open on About.
     */
    await renderProfileTab(
        profile,
        "about"
    );


    /*
     * Edit Profile
     */
    const editButton =
        document.getElementById(
            "editProfileBtn"
        );

    if (editButton) {

        editButton.addEventListener(
            "click",
            () => openEditProfile(profile)
        );

    }


    /*
     * Tabs
     */
    document
        .querySelectorAll(
            ".profile-tab"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                async () => {

                    document
                        .querySelectorAll(
                            ".profile-tab"
                        )
                        .forEach(tab =>
                            tab.classList.remove(
                                "active"
                            )
                        );

                    button.classList.add(
                        "active"
                    );

                    await renderProfileTab(
                        profile,
                        button.dataset.tab
                    );

                }
            );

        });

}


/* =========================================================
   ACCOUNT AGE
   ========================================================= */

function formatAccountAge(date) {

    const now =
        new Date();

    let years =
        now.getFullYear() -
        date.getFullYear();

    let months =
        now.getMonth() -
        date.getMonth();

    if (months < 0) {

        years--;

        months += 12;

    }

    if (years > 0) {

        return `${years} year${
            years === 1
                ? ""
                : "s"
        } ago`;

    }

    if (months > 0) {

        return `${months} month${
            months === 1
                ? ""
                : "s"
        } ago`;

    }

    return "Less than a month ago";
}


/* =========================================================
   PROFILE TABS
   ========================================================= */

async function renderProfileTab(
    profile,
    tab
) {

    const box =
        document.getElementById(
            "profileTabContent"
        );

    if (!box) return;


    /* =====================================================
       ABOUT
       ===================================================== */

    if (tab === "about") {

        box.innerHTML = `

            <section class="profile-about">

                <h2>
                    About
                </h2>


                ${
                    profile.bio
                        ? `
                            <p>

                                ${esc(
                                    profile.bio
                                )}

                            </p>
                        `
                        : `
                            <p class="muted">

                                No bio added yet.

                            </p>
                        `
                }


                ${
                    profile.country
                        ? `
                            <div
                                class="profile-detail">

                                <span>
                                    Country
                                </span>

                                <strong>

                                    ${esc(
                                        profile.country
                                    )}

                                </strong>

                            </div>
                        `
                        : ""
                }


                ${
                    profile.social_link
                        ? `
                            <div
                                class="profile-detail">

                                <span>
                                    Social
                                </span>

                                <a
                                    href="${esc(
                                        profile.social_link
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer">

                                    ${esc(
                                        profile.social_link
                                    )}

                                </a>

                            </div>
                        `
                        : ""
                }

            </section>

        `;

        return;
    }


    /* =====================================================
       CREATOR POSTS
       ===================================================== */

    if (tab === "posts") {

        box.innerHTML = `

            <section>

                <h2>
                    Posts
                </h2>

                <div
                    id="myProfilePosts"
                    class="grid">

                    Loading...

                </div>

            </section>

        `;

        const {
            data
        } =
            await window.supabaseClient
                .from("videos")
                .select("*")
                .eq(
                    "uploader_id",
                    profile.id
                )
                .eq(
                    "status",
                    "published"
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                )
                .limit(30);

        const grid =
            document.getElementById(
                "myProfilePosts"
            );

        if (!grid) return;

        if (
            !data ||
            !data.length
        ) {

            grid.innerHTML = `
                <p class="muted">
                    No posts yet.
                </p>
            `;

            return;
        }

        grid.innerHTML =
            data
                .map(normalizeVideo)
                .map(createCard)
                .join("");

        setupPreviews();

        return;
    }


    /* =====================================================
       CREATOR COMMENTS
       ===================================================== */

    if (tab === "comments") {

        box.innerHTML = `

            <section
                class="profile-comments">

                <h2>
                    Comments
                </h2>

                <p class="muted">

                    Your comments will appear here.

                </p>

            </section>

        `;

    }

}


/* =========================================================
   EDIT PROFILE
   ========================================================= */

function openEditProfile(
    profile
) {

    const existing =
        document.getElementById(
            "editProfileModal"
        );

    if (existing) {
        existing.remove();
    }


    const modal =
        document.createElement(
            "div"
        );

    modal.id =
        "editProfileModal";

    modal.className =
        "modal-overlay";


    modal.innerHTML = `

        <div
            class="edit-profile-modal">


            <button
                class="modal-close"
                id="closeEditProfile">

                ×

            </button>


            <h2>
                Edit Profile
            </h2>


            <label>

                Display name

                <input
                    id="editDisplayName"
                    value="${esc(
                        profile.display_name ||
                        ""
                    )}"
                    maxlength="80">

            </label>


            <label>

                Username

                <input
                    value="@${esc(
                        profile.username ||
                        ""
                    )}"
                    disabled>

            </label>


            <label>

                Bio

                <textarea
                    id="editBio"
                    maxlength="500"
                    placeholder="Tell people about yourself...">${esc(
                        profile.bio ||
                        ""
                    )}</textarea>

            </label>


            <label>

                Profile picture URL

                <input
                    id="editAvatar"
                    value="${esc(
                        profile.avatar_url ||
                        ""
                    )}"
                    placeholder="https://...">

            </label>


            <label>

                Social network link

                <input
                    id="editSocial"
                    value="${esc(
                        profile.social_link ||
                        ""
                    )}"
                    placeholder="https://...">

            </label>


            <button
                class="btn primary"
                id="saveProfileBtn">

                Save Profile

            </button>


            <div
                id="profileSaveMessage"
                class="muted">

            </div>


        </div>

    `;


    document.body.appendChild(
        modal
    );


    /*
     * Close
     */
    const closeButton =
        document.getElementById(
            "closeEditProfile"
        );

    if (closeButton) {

        closeButton.onclick =
            () => modal.remove();

    }


    /*
     * Save
     */
    const saveButton =
        document.getElementById(
            "saveProfileBtn"
        );

    if (!saveButton) return;


    saveButton.onclick =
        async () => {

            saveButton.disabled =
                true;

            saveButton.textContent =
                "Saving...";


            const updates = {

                display_name:
                    document
                        .getElementById(
                            "editDisplayName"
                        )
                        .value
                        .trim(),

                bio:
                    document
                        .getElementById(
                            "editBio"
                        )
                        .value
                        .trim(),

                avatar_url:
                    document
                        .getElementById(
                            "editAvatar"
                        )
                        .value
                        .trim(),

                social_link:
                    document
                        .getElementById(
                            "editSocial"
                        )
                        .value
                        .trim(),

                updated_at:
                    new Date()
                        .toISOString()

            };


            const {
                error
            } =
                await window.supabaseClient
                    .from("profiles")
                    .update(updates)
                    .eq(
                        "id",
                        profile.id
                    );


            if (error) {

                saveButton.disabled =
                    false;

                saveButton.textContent =
                    "Save Profile";

                const message =
                    document.getElementById(
                        "profileSaveMessage"
                    );

                if (message) {

                    message.textContent =
                        error.message;

                }

                return;
            }


            modal.remove();

            await renderMyProfile();

        };

}


/* =========================================================
   HELPERS
   ========================================================= */

function formatViews(n) {

    return Number(
        n || 0
    ).toLocaleString();

}


function esc(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[character])
    );

}