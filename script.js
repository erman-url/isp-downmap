const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquQ/formResponse";

const FORM_ENTRY_IDS = {
  isp: "entry.1321343715", il: "entry.1048550212", ilce: "entry.1808925592",
  enlem: "entry.119292663", boylam: "entry.1923451466",
  aciklama: "entry.1702812039",
  kesintiTarihi_year: "entry.888686904_year",
  kesintiTarihi_month: "entry.888686904_month",
  kesintiTarihi_day: "entry.888686904_day",
  baslangicSaati_hour: "entry.1555945811_hour",
  baslangicSaati_minute: "entry.1555945811_minute",
  tahminiBitisSaati_hour: "entry.126525220_hour",
  tahminiBitisSaati_minute: "entry.126525220_minute"
};

let map, marker = null, selectedCoords = null;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initMap, 200);
  loadLeaderboard();
});

function initMap() {
  const TURKEY_BOUNDS = [[35.8154, 25.5670], [42.1000, 44.8110]];
  const turkeyBounds = L.latLngBounds(TURKEY_BOUNDS);
  const TURKEY_CENTER = [39.9334, 32.8597];

  map = L.map("map", {
    center: TURKEY_CENTER,
    zoom: 6,
    minZoom: 4,
    maxBounds: turkeyBounds,
    maxBoundsViscosity: 1.0
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(map);

  if (L.Control && L.Control.Geocoder) {
    L.Control.geocoder({
      defaultMarkGeocode: false,
      placeholder: "Adres ara (TR)...",
      collapsed: L.Browser.mobile,
      geocoder: L.Control.Geocoder.nominatim({ countrycodes: "tr" })
    })
      .on("markgeocode", e => {
        const c = e.geocode.center;
        if (!turkeyBounds.contains(c)) {
          L.popup().setLatLng(c).setContent("Türkiye dışı seçim yapılamaz.").openOn(map);
          return;
        }
        placeMarker([c.lat, c.lng]);
        fillCityInfo(c.lat, c.lng);
        map.setView([c.lat, c.lng], 13);
      })
      .addTo(map);
  }

  map.on("click", e => {
    const { lat, lng } = e.latlng;
    if (!turkeyBounds.contains(e.latlng)) {
      L.popup().setLatLng(e.latlng)
        .setContent("Bu nokta Türkiye dışında — izin verilmiyor.")
        .openOn(map);
      return;
    }
    placeMarker([lat, lng]);
    fillCityInfo(lat, lng);
  });

  map.on("moveend", () => {
    const c = map.getCenter();
    if (!turkeyBounds.contains(c)) {
      const sw = turkeyBounds.getSouthWest();
      const ne = turkeyBounds.getNorthEast();
      const clampLat = Math.max(sw.lat, Math.min(c.lat, ne.lat));
      const clampLng = Math.max(sw.lng, Math.min(c.lng, ne.lng));
      map.panTo([clampLat, clampLng]);
      L.popup().setLatLng([clampLat, clampLng])
        .setContent("Harita sınır dışına çıktı, geri çekildi.")
        .openOn(map);
    }
  });

  function placeMarker([lat, lng]) {
    selectedCoords = { lat, lng };
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng]).addTo(map);

    document.getElementById("selected-location").textContent =
      `Seçilen Konum: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }

  setTimeout(() => map.invalidateSize(), 300);
}

function fillCityInfo(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`)
    .then(r => r.json())
    .then(data => {
      const a = data.address || {};
      let il = a.province || a.state || "Bilinmiyor";
      let ilce = a.city || a.town || a.village || "Bilinmiyor";
      if (il === ilce && a.state_district) ilce = a.state_district;
      document.getElementById("il").value = il;
      document.getElementById("ilce").value = ilce;
    })
    .catch(() => {
      document.getElementById("il").value = "Hata";
      document.getElementById("ilce").value = "Hata";
    });
}

function showAlert(msg, isSuccess = false) {
  const alerts = document.getElementById("alerts");
  const box = document.createElement("div");
  box.className = "alert-box " + (isSuccess ? "alert-success" : "");
  box.innerHTML = `<strong>${isSuccess ? "Bilgi" : "Uyarı"}</strong><div>${msg}</div>`;
  alerts.appendChild(box);
  setTimeout(() => alerts.removeChild(box), 15000);
}

function sanitizeText(text) {
  return text.replace(/[<>]/g, "");
}

document.getElementById("kesinti-form").addEventListener("submit", e => {
  e.preventDefault();

  const isp = document.getElementById("isp").value;
  const il = document.getElementById("il").value;
  const ilce = document.getElementById("ilce").value;
  const kesintiTarihi = document.getElementById("kesintiTarihi").value;
  const tahminiBitisSaati = document.getElementById("tahminiBitisSaati").value;
  const aciklama = sanitizeText(document.getElementById("aciklama").value);
  const captcha = Number(document.getElementById("captcha").value);

  if (captcha !== 8) return showAlert("CAPTCHA hatalı.");
  if (!selectedCoords) return showAlert("Lütfen haritada bir konum seçin.");
  if (!kesintiTarihi) return showAlert("Kesinti tarihi boş olamaz.");

  const dt = new Date(kesintiTarihi);
  if (dt > new Date()) return showAlert("Kesinti tarihi gelecekte olamaz.");

  const formData = new URLSearchParams();
  formData.append(FORM_ENTRY_IDS.isp, isp);
  formData.append(FORM_ENTRY_IDS.il, il);
  formData.append(FORM_ENTRY_IDS.ilce, ilce);
  formData.append(FORM_ENTRY_IDS.enlem, selectedCoords.lat);
  formData.append(FORM_ENTRY_IDS.boylam, selectedCoords.lng);
  formData.append(FORM_ENTRY_IDS.aciklama, aciklama);
  formData.append(FORM_ENTRY_IDS.kesintiTarihi_year, dt.getFullYear());
  formData.append(FORM_ENTRY_IDS.kesintiTarihi_month, dt.getMonth() + 1);
  formData.append(FORM_ENTRY_IDS.kesintiTarihi_day, dt.getDate());
  formData.append(FORM_ENTRY_IDS.baslangicSaati_hour, dt.getHours());
  formData.append(FORM_ENTRY_IDS.baslangicSaati_minute, dt.getMinutes());

  if (tahminiBitisSaati) {
    const [h, m] = tahminiBitisSaati.split(":");
    formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_hour, h);
    formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_minute, m);
  }

  fetch(GOOGLE_FORM_URL, { method: "POST", mode: "no-cors", body: formData })
    .then(() => {
      showAlert("Bildirim başarıyla gönderildi!", true);
      document.getElementById("kesinti-form").reset();
      document.getElementById("il").value = "";
      document.getElementById("ilce").value = "";
      selectedCoords = null;
      if (marker) {
        map.removeLayer(marker);
        marker = null;
      }
      document.getElementById("selected-location").textContent =
        "Seçilen Konum: Belirtilmedi";
    })
    .catch(() => showAlert("Gönderimde hata oluştu."));
});

// ---- yeni hesaplama fonksiyonları ----
function calcMinutes(start, end) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const diff = Math.round((e - s) / 60000);
  return Math.max(0, isFinite(diff) ? diff : 0);
}

function getTopIspByOutage(data, topN = 3) {
  const totals = {};
  (data.reports || []).forEach(r => {
    if (!r.isp || !r.start) return;
    const mins = calcMinutes(r.start, r.end);
    totals[r.isp] = (totals[r.isp] || 0) + mins;
  });
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([isp, total]) => ({ isp, totalMinutes: total }));
}

function getTopLocationByOutage(data, topN = 3) {
  const mapLoc = {};
  (data.reports || []).forEach(r => {
    if (!r.il || !r.ilce || !r.start) return;
    const key = `${r.il} / ${r.ilce}`;
    const mins = calcMinutes(r.start, r.end);
    mapLoc[key] = (mapLoc[key] || 0) + mins;
  });
  return Object.entries(mapLoc)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([location, total]) => ({ location, totalMinutes: total }));
}

function loadLeaderboard() {
  fetch("data.json")
    .then(res => res.json())
    .then(data => {
      const lb = document.getElementById("leaderboard");
      lb.innerHTML = "";

      (data.leaderboard || []).forEach(item => {
        const div = document.createElement("div");
        div.className = "leaderboard-item";
        div.innerHTML = `<b>${item.isp}</b><span>${item.count} Bildirim</span>`;
        lb.appendChild(div);
      });

      document.getElementById("totalReports").textContent =
        data.stats?.totalReports ?? 0;

      document.getElementById("activeOutages").textContent =
        data.stats?.activeOutages ?? 0;

      const topISP = getTopIspByOutage(data);
      const topLOC = getTopLocationByOutage(data);

      const ispDiv = document.getElementById("topISP");
      ispDiv.innerHTML = topISP.length
        ? topISP
            .map(
              i =>
                `<div class="leaderboard-item"><b>${i.isp}</b> <span>${(
                  i.totalMinutes / 60
                ).toFixed(1)} Saat</span></div>`
            )
            .join("")
        : "<div>Veri yok</div>";

      const locDiv = document.getElementById("topLOC");
      locDiv.innerHTML = topLOC.length
        ? topLOC
            .map(
              i =>
                `<div class="leaderboard-item"><b>${i.location}</b> <span>${(
                  i.totalMinutes / 60
                ).toFixed(1)} Saat</span></div>`
            )
            .join("")
        : "<div>Veri yok</div>";
    })
    .catch(err => {
      console.error("JSON yüklenemedi:", err);
      showAlert("Veri yüklenemedi: data.json bulunamadı veya bozuk.");
    });
}
