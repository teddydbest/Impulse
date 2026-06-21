/* NYC Exhaust / Noise Camera Map
 * Loads camera data from data/cameras.json and renders an interactive
 * Leaflet map with filtering, search, a synced list panel, and popups. */
(function () {
  "use strict";

  var NYC_CENTER = [40.7300, -73.9700];
  var DEFAULT_ZOOM = 11;

  var state = {
    cameras: [],
    meta: {},
    markers: {},        // id -> Leaflet marker
    boroughFilter: new Set(),
    statusFilter: new Set(),
    search: ""
  };

  var map, clusterGroup;
  var els = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheEls();
    initMap();
    bindUI();
    loadData();
  }

  function cacheEls() {
    els.list = document.getElementById("camera-list");
    els.count = document.getElementById("stat-count");
    els.total = document.getElementById("stat-total");
    els.search = document.getElementById("search");
    els.boroughFilters = document.getElementById("borough-filters");
    els.statusFilters = document.getElementById("status-filters");
    els.disclaimer = document.getElementById("disclaimer");
    els.sidebar = document.getElementById("sidebar");
    els.sidebarToggle = document.getElementById("sidebar-toggle");
    els.locateMe = document.getElementById("locate-me");
  }

  function initMap() {
    map = L.map("map", { zoomControl: true }).setView(NYC_CENTER, DEFAULT_ZOOM);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20
    }).addTo(map);

    clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 45,
      showCoverageOnHover: false
    });
    map.addLayer(clusterGroup);
  }

  function bindUI() {
    els.search.addEventListener("input", function (e) {
      state.search = e.target.value.trim().toLowerCase();
      render();
    });

    els.sidebarToggle.addEventListener("click", function () {
      els.sidebar.classList.toggle("open");
    });

    els.locateMe.addEventListener("click", locateMe);
  }

  function loadData() {
    // Standalone builds inline the dataset as window.__CAMERA_DATA__ so the
    // page works from a file:// URL without a server. Otherwise fetch it.
    if (window.__CAMERA_DATA__) {
      handleData(window.__CAMERA_DATA__);
      return;
    }
    fetch("data/cameras.json", { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(handleData)
      .catch(function (err) {
        els.list.innerHTML =
          '<li class="disclaimer">Could not load camera data (' +
          escapeHtml(err.message) +
          "). If you opened this file directly, run a local web server " +
          "(e.g. <code>python3 -m http.server</code>) so the browser can fetch the JSON.</li>";
      });
  }

  function handleData(data) {
        state.cameras = (data.cameras || []).filter(hasValidCoords);
        state.meta = data.meta || {};
        buildFilters();
        renderDisclaimer();
        render();
        if (state.cameras.length) {
          var b = L.latLngBounds(state.cameras.map(function (c) { return [c.lat, c.lng]; }));
          map.fitBounds(b.pad(0.15));
        }
  }

  function hasValidCoords(c) {
    return typeof c.lat === "number" && typeof c.lng === "number" &&
      !isNaN(c.lat) && !isNaN(c.lng);
  }

  /* ---- Filters ---- */
  function buildFilters() {
    var boroughs = unique(state.cameras.map(function (c) { return c.borough; })).sort();
    var statuses = unique(state.cameras.map(function (c) { return c.status; })).sort();

    renderChips(els.boroughFilters, boroughs, state.boroughFilter);
    renderChips(els.statusFilters, statuses, state.statusFilter);
  }

  function renderChips(container, values, activeSet) {
    container.innerHTML = "";
    values.forEach(function (val) {
      var chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = cap(val);
      chip.addEventListener("click", function () {
        if (activeSet.has(val)) activeSet.delete(val);
        else activeSet.add(val);
        chip.classList.toggle("active");
        render();
      });
      container.appendChild(chip);
    });
  }

  function passesFilters(c) {
    if (state.boroughFilter.size && !state.boroughFilter.has(c.borough)) return false;
    if (state.statusFilter.size && !state.statusFilter.has(c.status)) return false;
    if (state.search) {
      var hay = [c.address, c.neighborhood, c.borough, c.notes]
        .filter(Boolean).join(" ").toLowerCase();
      if (hay.indexOf(state.search) === -1) return false;
    }
    return true;
  }

  /* ---- Render ---- */
  function render() {
    var visible = state.cameras.filter(passesFilters);
    renderMarkers(visible);
    renderList(visible);
    els.count.textContent = visible.length;
    els.total.textContent = state.meta.totalDeployedPerCity || state.cameras.length;
  }

  function renderMarkers(visible) {
    clusterGroup.clearLayers();
    state.markers = {};
    visible.forEach(function (c) {
      var marker = L.marker([c.lat, c.lng], { icon: makeIcon(c) });
      marker.bindPopup(popupHtml(c), { maxWidth: 280 });
      clusterGroup.addLayer(marker);
      state.markers[c.id] = marker;
    });
  }

  function makeIcon(c) {
    var cls = c.status === "active" ? "active" : "reported";
    return L.divIcon({
      className: "",
      html: '<div class="cam-marker ' + cls + '"><span>📷</span></div>',
      iconSize: [30, 30],
      iconAnchor: [15, 28],
      popupAnchor: [0, -26]
    });
  }

  function renderList(visible) {
    els.list.innerHTML = "";
    if (!visible.length) {
      els.list.innerHTML = '<li class="disclaimer">No cameras match the current filters.</li>';
      return;
    }
    visible.forEach(function (c) {
      var li = document.createElement("li");
      li.className = "camera-item";
      var badgeClass = c.status === "active" ? "badge-active" : "badge-reported";
      li.innerHTML =
        '<div class="ci-addr">' + escapeHtml(c.address) + "</div>" +
        '<div class="ci-meta">' +
          escapeHtml(c.neighborhood || "") + " · " + escapeHtml(c.borough) +
          ' <span class="ci-badge ' + badgeClass + '">' + escapeHtml(c.status) + "</span>" +
        "</div>";
      li.addEventListener("click", function () { focusCamera(c); });
      els.list.appendChild(li);
    });
  }

  function focusCamera(c) {
    var marker = state.markers[c.id];
    map.setView([c.lat, c.lng], 16, { animate: true });
    if (marker) {
      // markercluster: zoom to show the marker, then open popup
      clusterGroup.zoomToShowLayer(marker, function () {
        marker.openPopup();
      });
    }
    if (window.innerWidth <= 760) els.sidebar.classList.remove("open");
  }

  function popupHtml(c) {
    var badgeClass = c.status === "active" ? "badge-active" : "badge-reported";
    var sources = (c.sources || []).map(function (url) {
      return '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' +
        escapeHtml(prettyUrl(url)) + "</a>";
    }).join("");

    return (
      '<div class="cam-popup">' +
        "<h3>" + escapeHtml(c.address) + "</h3>" +
        '<div class="cp-sub">' + escapeHtml(c.neighborhood || "") + " · " + escapeHtml(c.borough) + "</div>" +
        '<div class="cp-row">' +
          '<span class="ci-badge ' + badgeClass + '">' + escapeHtml(c.status) + "</span>" +
          '<span class="ci-badge badge-reported">' + escapeHtml(c.confidence || "reported") + "</span>" +
          '<span class="ci-badge badge-reported">' + escapeHtml(c.type || "noise/exhaust") + "</span>" +
        "</div>" +
        (c.notes ? '<div class="cp-notes">' + escapeHtml(c.notes) + "</div>" : "") +
        (sources ? '<div class="cp-sources"><strong>Sources:</strong>' + sources + "</div>" : "") +
      "</div>"
    );
  }

  function renderDisclaimer() {
    var src = (state.meta.sources || []).map(function (s) {
      return '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' +
        escapeHtml(s.label) + "</a>";
    }).join(" · ");

    els.disclaimer.innerHTML =
      "<p><strong>About this data.</strong> " +
      escapeHtml(state.meta.description || "") + "</p>" +
      (state.meta.lastUpdated ? "<p>Last updated: " + escapeHtml(state.meta.lastUpdated) + "</p>" : "") +
      (src ? "<p>Sources: " + src + "</p>" : "") +
      "<p>Spotted a camera or a mistake? Update " +
      "<code>data/cameras.json</code> and open a pull request.</p>";
  }

  function locateMe() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    els.locateMe.textContent = "…";
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var ll = [pos.coords.latitude, pos.coords.longitude];
        map.setView(ll, 14);
        L.circleMarker(ll, { radius: 8, color: "#4aa3ff", fillColor: "#4aa3ff", fillOpacity: 0.6 })
          .addTo(map).bindPopup("You are here").openPopup();
        els.locateMe.textContent = "📍 Near me";
      },
      function () {
        alert("Could not get your location.");
        els.locateMe.textContent = "📍 Near me";
      }
    );
  }

  /* ---- helpers ---- */
  function unique(arr) {
    return Array.from(new Set(arr.filter(Boolean)));
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function prettyUrl(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (e) { return url; }
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function escapeAttr(s) { return escapeHtml(s); }
})();
