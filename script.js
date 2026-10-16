"use strict";

// ==========================================
// API CONFIGURATION
// ==========================================
// Yahan aap apni OpenWeatherMap API key configure kar sakte hain:
const CLIMATE_API_KEY = "ba401ea01d7c1eaf62748aad7ecaeb75";

const $ = id => document.getElementById(id);
const BASE_URL = "https://api.openweathermap.org/data/2.5";
let currentCity = "";
let requestNumber = 0;
let favorites = [];

try {
  const stored = JSON.parse(localStorage.getItem("climateFavorites") || "[]");
  if (Array.isArray(stored)) favorites = stored.filter(x => typeof x === "string");
} catch {
  favorites = [];
}

function iconFor(code) {
  if (code === 800) return "☀️";
  if (code >= 801 && code <= 804) return "☁️";
  if (code >= 700) return "🌫️";
  if (code >= 600) return "❄️";
  if (code >= 500) return "🌧️";
  if (code >= 300) return "🌦️";
  if (code >= 200) return "⛈️";
  return "🌤️";
}

async function fetchJSON(url) {
  const response = await fetch(url);
  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Invalid response from weather service.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("API key is invalid or not activated yet. Check your OpenWeatherMap account.");
    }
    if (response.status === 404) {
      throw new Error("City not found. Check the spelling and try again.");
    }
    if (response.status === 429) {
      throw new Error("API request limit reached. Please try again later.");
    }
    throw new Error(data.message || `Weather request failed (${response.status}).`);
  }

  return data;
}

async function loadWeather(city) {
  city = city.trim();

  if (!city) {
    $("error").textContent = "Please enter a city name.";
    $("cityInput").focus();
    return;
  }

  if (!CLIMATE_API_KEY) {
    $("error").textContent = "API key is missing.";
    return;
  }

  const thisRequest = ++requestNumber;
  const units = $("units").value;
  const symbol = units === "metric" ? "°C" : "°F";
  const windUnit = units === "metric" ? "m/s" : "mph";
  const query = `q=${encodeURIComponent(city)}&appid=${encodeURIComponent(CLIMATE_API_KEY)}&units=${units}`;

  $("searchBtn").disabled = true;
  $("searchBtn").textContent = "Loading...";
  $("status").textContent = "Loading weather data...";
  $("error").textContent = "";

  try {
    const [weather, forecast] = await Promise.all([
      fetchJSON(`${BASE_URL}/weather?${query}`),
      fetchJSON(`${BASE_URL}/forecast?${query}`)
    ]);

    if (thisRequest !== requestNumber) return;

    currentCity = weather.name;
    $("cityName").textContent = `${weather.name}, ${weather.sys.country}`;
    $("weatherIcon").textContent = iconFor(weather.weather[0].id);
    $("temperature").textContent = `${Math.round(weather.main.temp)}${symbol}`;
    $("description").textContent = weather.weather[0].description;
    $("feelsLike").textContent = `Feels like ${Math.round(weather.main.feels_like)}${symbol}`;
    $("humidity").textContent = `${weather.main.humidity}%`;
    $("wind").textContent = `${weather.wind.speed} ${windUnit}`;
    $("pressure").textContent = `${weather.main.pressure} hPa`;
    $("visibility").textContent = `${(weather.visibility / 1000).toFixed(1)} km`;
    $("status").textContent = `Updated ${new Date().toLocaleTimeString()}`;

    const daily = new Map();

    for (const item of forecast.list) {
      const date = item.dt_txt.split(" ")[0];
      const hour = Number(item.dt_txt.slice(11, 13));
      const previous = daily.get(date);

      if (!previous ||
          Math.abs(hour - 12) < Math.abs(Number(previous.dt_txt.slice(11, 13)) - 12)) {
        daily.set(date, item);
      }
    }

    const days = Array.from(daily.values()).slice(0, 5);
    $("forecast").replaceChildren();

    for (const day of days) {
      const card = document.createElement("div");
      card.className = "day";

      const date = document.createElement("b");
      date.textContent = new Date(day.dt * 1000).toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
      });

      const icon = document.createElement("div");
      icon.className = "day-icon";
      icon.textContent = iconFor(day.weather[0].id);

      const temp = document.createElement("h3");
      temp.textContent = `${Math.round(day.main.temp)}${symbol}`;

      const desc = document.createElement("div");
      desc.textContent = day.weather[0].description;
      desc.style.textTransform = "capitalize";

      const humidity = document.createElement("p");
      humidity.className = "small";
      humidity.textContent = `Humidity ${day.main.humidity}%`;

      card.append(date, icon, temp, desc, humidity);
      $("forecast").append(card);
    }

  } catch (error) {
    if (thisRequest === requestNumber) {
      $("error").textContent = error.message || "Something went wrong.";
      $("status").textContent = "Weather data unavailable.";
    }
  } finally {
    if (thisRequest === requestNumber) {
      $("searchBtn").disabled = false;
      $("searchBtn").textContent = "Search";
    }
  }
}

function saveFavorites() {
  try {
    localStorage.setItem("climateFavorites", JSON.stringify(favorites));
  } catch {
    $("error").textContent = "Could not save favorites in this browser.";
  }
}

function renderFavorites() {
  const container = $("favorites");
  container.replaceChildren();

  if (favorites.length === 0) {
    container.textContent = "No favorite cities yet.";
    return;
  }

  favorites.forEach(city => {
    const row = document.createElement("div");
    row.className = "favorite";

    const openButton = document.createElement("button");
    openButton.textContent = city;
    openButton.addEventListener("click", () => {
      $("cityInput").value = city;
      loadWeather(city);
    });

    const removeButton = document.createElement("button");
    removeButton.textContent = "✕";
    removeButton.setAttribute("aria-label", `Remove ${city}`);
    removeButton.addEventListener("click", () => {
      favorites = favorites.filter(name => name !== city);
      saveFavorites();
      renderFavorites();
    });

    row.append(openButton, removeButton);
    container.append(row);
  });
}

$("searchBtn").addEventListener("click", () => loadWeather($("cityInput").value));

$("cityInput").addEventListener("keydown", event => {
  if (event.key === "Enter") loadWeather($("cityInput").value);
});

$("units").addEventListener("change", () => {
  if (currentCity) loadWeather(currentCity);
});

$("saveBtn").addEventListener("click", () => {
  if (!currentCity) {
    $("error").textContent = "Search for a city before saving it.";
    return;
  }

  if (!favorites.some(name => name.toLowerCase() === currentCity.toLowerCase())) {
    favorites.push(currentCity);
    saveFavorites();
    renderFavorites();
  }

  $("error").textContent = "";
});

renderFavorites();
loadWeather("Ahmedabad");
