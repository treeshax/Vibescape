
async function getSpotifyToken() {
    let id = SPOTIFY_CLIENT_ID;
    let secret = SPOTIFY_CLIENT_SECRET;

    let authString = btoa(id + ":" + secret);

    let response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + authString
        },
        body: "grant_type=client_credentials"
    });

    let data = await response.json();
    return data.access_token;
}

async function searchSpotify(query) {
    console.log("Search query started");
    console.log(query);
    
    const token = await getSpotifyToken();

    const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
        {
            headers: {
                Authorization: `Bearer ${token}`
            }
        }
    );

    let spotifyData = await response.json();
    return spotifyData;
}

function displayData(data) {
    let container = document.getElementById("results-container");
    container.innerHTML = ""; 
    let items = data.tracks.items;

    items.forEach(function(item) {
        let card = document.createElement("div");
        card.className = "song-card";

        let img = document.createElement("img");
        if (item.album.images.length > 0) {
            img.src = item.album.images[0].url;
        } else {
            img.src = "https://via.placeholder.com/150"; 
        }
        
        let title = document.createElement("h3");
        title.className = "song-title";
        title.textContent = item.name;
        let artist = document.createElement("p");
        artist.className = "song-artist";
        artist.textContent = item.artists[0].name; 

        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(artist);
        container.appendChild(card);
    });
}

// -------------
// User Auth & Implicit Grant
// -------------

const SCOPES = "user-read-private user-read-email playlist-read-private user-library-read user-read-recently-played user-top-read";
const REDIRECT_URI = "http://127.0.0.1:5500/"; // Update if necessary
let userAccessToken = null;

// Stores ALL liked songs (unfiltered) for client-side filtering
let allLikedSongs = [];

// -------------
// PKCE Helpers
// -------------

function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// On Page Load: Check if we have an authorization code from Spotify in the URL Let's exchange it!
window.addEventListener('load', async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
        let codeVerifier = window.localStorage.getItem('code_verifier');
        
        let body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
            client_id: SPOTIFY_CLIENT_ID,
            code_verifier: codeVerifier
        });

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body
            });
            const data = await response.json();
            
            if (data.access_token) {
                userAccessToken = data.access_token;
                
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
                
                // Show dashboard, hide welcome
                document.getElementById('welcome-section').style.display = 'none';
                document.getElementById('user-dashboard').style.display = 'block';

                // Load data
                await loadUserDashboard();
            } else {
                console.error("Token exchange failed: ", data);
            }
        } catch (error) {
            console.error("Error during token exchange: ", error);
        }
    }
});

// -------------
// Data Fetchers
// -------------

async function fetchSpotifyAPI(endpoint) {
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        headers: {
            Authorization: `Bearer ${userAccessToken}`
        }
    });
    return response.json();
}

async function loadUserDashboard() {
    try {
        // Fetch Profile
        const profile = await fetchSpotifyAPI('/me');
        document.getElementById('profile-name').innerText = profile.display_name || "User";
        document.getElementById('profile-email').innerText = profile.email || "";
        if (profile.images && profile.images.length > 0) {
            document.getElementById('profile-img').src = profile.images[0].url;
        } else {
            document.getElementById('profile-img').src = "https://via.placeholder.com/150";
        }

        // Fetch Top Artists
        const topArtists = await fetchSpotifyAPI('/me/top/artists?limit=10');
        renderCards(topArtists.items, 'top-artists-container', true);

        // Fetch Recently Played
        const recentlyPlayed = await fetchSpotifyAPI('/me/player/recently-played?limit=10');
        const recentTracks = recentlyPlayed.items.map(item => item.track);
        renderCards(recentTracks, 'recently-played-container');

        // Fetch Liked Songs (fetch up to 50 for filter UX)
        const likedSongs = await fetchSpotifyAPI('/me/tracks?limit=50');
        allLikedSongs = likedSongs.items.map(item => item.track);
        renderLikedSongs(allLikedSongs);

        // Fetch Playlists
        const playlists = await fetchSpotifyAPI('/me/playlists?limit=10');
        renderCards(playlists.items, 'playlists-container');

    } catch (err) {
        console.error("Error loading dashboard data:", err);
    }
}

function renderCards(items, containerId, isArtist = false) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    items.forEach(item => {
        let card = document.createElement("div");
        card.className = "song-card";
        if (isArtist) card.classList.add("artist-card");

        let imgUrl = "https://via.placeholder.com/150";
        if (isArtist && item.images && item.images.length > 0) {
            imgUrl = item.images[0].url;
        } else if (!isArtist && item.album && item.album.images && item.album.images.length > 0) {
            imgUrl = item.album.images[0].url;
        } else if (!isArtist && item.images && item.images.length > 0) {
            // For playlists
            imgUrl = item.images[0].url;
        }

        let img = document.createElement("img");
        img.src = imgUrl;
        
        let title = document.createElement("h3");
        title.className = "song-title";
        title.textContent = item.name;

        let subtitle = document.createElement("p");
        subtitle.className = "song-artist";
        
        if (item.artists && item.artists.length > 0) {
            subtitle.textContent = item.artists[0].name; 
        } else if (item.owner) {
            // For playlists
            subtitle.textContent = "By " + item.owner.display_name;
        } else if (isArtist && item.genres) {
            subtitle.textContent = item.genres.slice(0, 2).join(', ');
        }

        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(subtitle);
        container.appendChild(card);
    });
}

// ----------------------
// Liked Songs Filter Logic
// ----------------------

function renderLikedSongs(tracks) {
    const container = document.getElementById('liked-songs-container');
    const countEl = document.getElementById('liked-count');
    container.innerHTML = '';

    if (tracks.length === 0) {
        container.innerHTML = '<p class="no-results">No songs match your filters.</p>';
        countEl.textContent = '0 songs';
        return;
    }

    countEl.textContent = `${tracks.length} song${tracks.length !== 1 ? 's' : ''}`;

    tracks.forEach(track => {
        const card = document.createElement('div');
        card.className = 'song-card liked-card';

        // Data attributes for filter hint tooltip
        card.dataset.artist = (track.artists || []).map(a => a.name).join(', ');
        card.dataset.album = track.album?.name || '';
        card.dataset.year = (track.album?.release_date || '').slice(0, 4);
        card.dataset.popularity = track.popularity ?? '';
        card.dataset.explicit = track.explicit ? 'true' : 'false';

        const imgUrl = track.album?.images?.[0]?.url || 'https://via.placeholder.com/150';
        const img = document.createElement('img');
        img.src = imgUrl;
        img.alt = track.name;

        const title = document.createElement('h3');
        title.className = 'song-title';
        title.textContent = track.name;

        const artist = document.createElement('p');
        artist.className = 'song-artist';
        artist.textContent = card.dataset.artist;

        const meta = document.createElement('div');
        meta.className = 'song-meta';

        const yearBadge = card.dataset.year
            ? `<span class="badge badge-year">${card.dataset.year}</span>` : '';
        const popBadge = card.dataset.popularity !== ''
            ? `<span class="badge badge-pop">⭐ ${card.dataset.popularity}</span>` : '';
        const explicitBadge = track.explicit
            ? `<span class="badge badge-explicit">E</span>` : '';

        meta.innerHTML = yearBadge + popBadge + explicitBadge;

        card.appendChild(img);
        card.appendChild(title);
        card.appendChild(artist);
        card.appendChild(meta);
        container.appendChild(card);
    });
}

function applyLikedFilters() {
    const artist = document.getElementById('filter-artist').value.trim().toLowerCase();
    const album = document.getElementById('filter-album').value.trim().toLowerCase();
    const year = parseInt(document.getElementById('filter-year').value, 10);
    const minPop = parseInt(document.getElementById('filter-popularity').value, 10);
    const explicitOnly = document.getElementById('filter-explicit').checked;
    const cleanOnly = document.getElementById('filter-clean').checked;

    const filtered = allLikedSongs.filter(track => {
        const trackArtists = (track.artists || []).map(a => a.name.toLowerCase()).join(' ');
        const trackAlbum = (track.album?.name || '').toLowerCase();
        const trackYear = parseInt((track.album?.release_date || '').slice(0, 4), 10);
        const trackPop = track.popularity ?? 0;
        const isExplicit = track.explicit;

        if (artist && !trackArtists.includes(artist)) return false;
        if (album && !trackAlbum.includes(album)) return false;
        if (!isNaN(year) && trackYear < year) return false;
        if (minPop > 0 && trackPop < minPop) return false;
        if (explicitOnly && !isExplicit) return false;
        if (cleanOnly && isExplicit) return false;

        return true;
    });

    const sorted = sortLikedSongs(filtered);
    renderLikedSongs(sorted);
    updateActiveChips({ artist, album, year, minPop, explicitOnly, cleanOnly });
}

function sortLikedSongs(tracks) {
    const val = document.getElementById('sort-select').value;
    if (val === 'default') return tracks;

    return [...tracks].sort((a, b) => {
        switch (val) {
            case 'name-asc':    return a.name.localeCompare(b.name);
            case 'name-desc':   return b.name.localeCompare(a.name);
            case 'artist-asc':  return (a.artists?.[0]?.name || '').localeCompare(b.artists?.[0]?.name || '');
            case 'artist-desc': return (b.artists?.[0]?.name || '').localeCompare(a.artists?.[0]?.name || '');
            case 'year-asc':    return (a.album?.release_date || '').localeCompare(b.album?.release_date || '');
            case 'year-desc':   return (b.album?.release_date || '').localeCompare(a.album?.release_date || '');
            case 'pop-asc':     return (a.popularity ?? 0) - (b.popularity ?? 0);
            case 'pop-desc':    return (b.popularity ?? 0) - (a.popularity ?? 0);
            default:            return 0;
        }
    });
}

function updateActiveChips({ artist, album, year, minPop, explicitOnly, cleanOnly }) {
    const chipsContainer = document.getElementById('active-chips');
    chipsContainer.innerHTML = '';

    const add = (label, clearFn) => {
        const chip = document.createElement('span');
        chip.className = 'filter-chip';
        chip.innerHTML = `${label} <button class="chip-remove" title="Remove">✕</button>`;
        chip.querySelector('.chip-remove').addEventListener('click', () => { clearFn(); applyLikedFilters(); });
        chipsContainer.appendChild(chip);
    };

    if (artist) add(`🎤 ${artist}`, () => { document.getElementById('filter-artist').value = ''; });
    if (album) add(`💿 ${album}`, () => { document.getElementById('filter-album').value = ''; });
    if (!isNaN(year)) add(`📅 After ${year}`, () => { document.getElementById('filter-year').value = ''; });
    if (minPop > 0) add(`⭐ Pop ≥ ${minPop}`, () => { document.getElementById('filter-popularity').value = 0; document.getElementById('popularity-value').textContent = '0'; });
    if (explicitOnly) add('🔞 Explicit', () => { document.getElementById('filter-explicit').checked = false; });
    if (cleanOnly) add('🧼 Clean', () => { document.getElementById('filter-clean').checked = false; });

    const sortVal = document.getElementById('sort-select').value;
    const sortLabels = {
        'name-asc': '↑ Name A–Z', 'name-desc': '↓ Name Z–A',
        'artist-asc': '↑ Artist A–Z', 'artist-desc': '↓ Artist Z–A',
        'year-desc': '↓ Newest', 'year-asc': '↑ Oldest',
        'pop-desc': '↓ Most Popular', 'pop-asc': '↑ Least Popular'
    };
    if (sortVal !== 'default') {
        add(`↕ ${sortLabels[sortVal]}`, () => { document.getElementById('sort-select').value = 'default'; });
    }
}

// -------------
// Event Listeners
// -------------

let button = document.getElementById("get-data-btn");
let searchInput = document.querySelector(".search-bar");
const loginBtn = document.getElementById("login-btn");

loginBtn.addEventListener("click", async function () {
    const codeVerifier = generateRandomString(128);
    window.localStorage.setItem('code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    const params = new URLSearchParams({
        client_id: SPOTIFY_CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge
    });

    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
});

// Kept Search functionality with Client Credentials
button.addEventListener("click", async function() {
    let query = searchInput.value || "Top Hits";
    let apiData = await searchSpotify(query);
    displayData(apiData);
});

searchInput.addEventListener("keypress", async function(event) {
    if (event.key === "Enter") {
        let query = searchInput.value;
        if (query) {
            let apiData = await searchSpotify(query);
            displayData(apiData);
        }
    }
});

// ----------------------
// Liked Songs Filter Events
// ----------------------

function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

const debouncedFilter = debounce(applyLikedFilters, 250);

document.getElementById('filter-artist').addEventListener('input', debouncedFilter);
document.getElementById('filter-album').addEventListener('input', debouncedFilter);
document.getElementById('filter-year').addEventListener('input', debouncedFilter);

document.getElementById('filter-popularity').addEventListener('input', function () {
    document.getElementById('popularity-value').textContent = this.value;
    applyLikedFilters();
});

document.getElementById('filter-explicit').addEventListener('change', function () {
    if (this.checked) document.getElementById('filter-clean').checked = false;
    applyLikedFilters();
});

document.getElementById('filter-clean').addEventListener('change', function () {
    if (this.checked) document.getElementById('filter-explicit').checked = false;
    applyLikedFilters();
});

document.getElementById('sort-select').addEventListener('change', applyLikedFilters);

document.getElementById('filter-reset-btn').addEventListener('click', () => {
    document.getElementById('filter-artist').value = '';
    document.getElementById('filter-album').value = '';
    document.getElementById('filter-year').value = '';
    document.getElementById('filter-popularity').value = 0;
    document.getElementById('popularity-value').textContent = '0';
    document.getElementById('filter-explicit').checked = false;
    document.getElementById('filter-clean').checked = false;
    document.getElementById('sort-select').value = 'default';
    applyLikedFilters();
});
