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

let button = document.getElementById("get-data-btn");
let searchInput = document.querySelector(".search-bar");
button.addEventListener("click", async function() {
    let query = searchInput.value;
    
    if (!query) {
        query = "Top Hits";
        console.log("No query entered, defaulting to: " + query);
    }
    
    let apiData = await searchSpotify(query);
    console.log("Here is the search data:", apiData);
    
    displayData(apiData);
});

searchInput.addEventListener("keypress", async function(event) {
    if (event.key === "Enter") {
        let query = searchInput.value;
        if (query) {
            let apiData = await searchSpotify(query);
            console.log("Here is the search data:", apiData);
            
            displayData(apiData);
        }
    }
});
