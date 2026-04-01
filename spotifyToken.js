console.log("Hey there")
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from "./config.js";

let accessToken = null;
let tokenExpiry = 0;
let tokenPromise = null;

export async function getSpotifyToken() {
    if (accessToken && Date.now() < tokenExpiry) {
        console.log("Using cached Token");
        return accessToken;
    }

    if (tokenPromise) {
        console.log("Waiting for existing token request");
        return tokenPromise;
    }

    tokenPromise = fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization:
                "Basic " + btoa(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
        }),
    })
        .then(res => res.json())
        .then(data => {
            accessToken = data.access_token;
            tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

            tokenPromise = null; // reset

            return accessToken;
        });

    return tokenPromise;
}

export async function api() {
    let ACCESS_TOKEN = await getSpotifyToken();
    console.log(ACCESS_TOKEN)
}

window.api = api;