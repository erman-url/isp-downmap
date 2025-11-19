// LÜTFEN BU URL'Yİ VE AŞAĞIDAKİ ID'LERİ KENDİ GÜNCEL GOOGLE FORM'UNUZDAN ALIN!
// EĞER VERİ GOOGLE SHEETS'E YAZILMIYORSA, SORUN BU SABİTLERDEDİR.
const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquQ/formResponse";

// Kendi formunuzdaki her alanın benzersiz ID'sini (entry.XXXX) buraya girin.
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

// Veri kaynağı artık yerel JSON dosyasıdır.
const LOCAL_JSON_DATA_URL = "./data.json"; 

let map, marker = null, selectedCoords = null;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initMap, 200);
  // Veriyi yükle ve tabloları güncelle
  loadAndProcessSheetData(); 
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
  // Uyarıyı 15 saniye ekranda tut
  setTimeout(() => {
    if (alerts.contains(box)) {
      alerts.removeChild(box);
    }
  }, 15000); 
}

function sanitizeText(text) {
  // HTML etiketlerini kaldırır.
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

  if (captcha !== 8) return showAlert("CAPTCHA hatalı. Lütfen doğru yanıtı girin (5 + 3).");
  if (!selectedCoords) return showAlert("Lütfen haritada bir konum seçin.");
  if (!kesintiTarihi) return showAlert("Kesinti tarihi boş olamaz.");

  const dt = new Date(kesintiTarihi);
  // Kullanıcının gelecekteki bir kesintiyi bildirmesini engelle.
  if (dt > new Date()) return showAlert("Kesinti tarihi gelecekte olamaz.");

  const formData = new URLSearchParams();
  formData.append(FORM_ENTRY_IDS.isp, isp);
  formData.append(FORM_ENTRY_IDS.il, il);
  formData.append(FORM_ENTRY_IDS.ilce, ilce);
  formData.append(FORM_ENTRY_IDS.enlem, selectedCoords.lat);
  formData.append(FORM_ENTRY_IDS.boylam, selectedCoords.lng);
  formData.append(FORM_ENTRY_IDS.aciklama, aciklama);
  
  // Date input'tan (YYYY-MM-DD) gelen değeri yıl, ay, gün olarak parçala
  const [year, month, day] = kesintiTarihi.split('-');
  formData.append(FORM_ENTRY_IDS.kesintiTarihi_year, year);
  formData.append(FORM_ENTRY_IDS.kesintiTarihi_month, month);
  formData.append(FORM_ENTRY_IDS.kesintiTarihi_day, day);

  // Başlangıç Saati: Şu anki saat ve dakikayı al
  const now = new Date();
  formData.append(FORM_ENTRY_IDS.baslangicSaati_hour, now.getHours());
  formData.append(FORM_ENTRY_IDS.baslangicSaati_minute, now.getMinutes());

  // Tahmini Bitiş Saati varsa saat ve dakikayı ekle
  if (tahminiBitisSaati) {
    const [h, m] = tahminiBitisSaati.split(":");
    formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_hour, h);
    formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_minute, m);
  }

  // Google Form'a gönderim
  fetch(GOOGLE_FORM_URL, { method: "POST", mode: "no-cors", body: formData })
    .then(response => {
        // 'no-cors' nedeniyle response durumunu kontrol edemeyiz, başarılı kabul ederiz.
        showAlert("Bildirim gönderildi. **Ancak Sheets'e veri gitmiyorsa, lütfen GOOGLE_FORM_URL ve ID'leri kontrol edin.** Uygulamadaki verilerin güncellenmesi için `data.json` dosyasını manuel olarak güncellemeniz GEREKİR.", true);
        
        // Form alanlarını sıfırla
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
        
        // Form gönderildikten sonra verileri yeniden yükle (data.json'ı okuyacak)
        loadAndProcessSheetData(); 
    })
    .catch(error => {
        // Bu hata, tarayıcı veya ağ ile ilgili bir sorundur (örneğin URL hatası)
        const detailedErrorMsg = `Gönderim sırasında KRİTİK HATA oluştu. Bu, URL'nin yanlış olduğunu veya tarayıcı/ağ sorunu olduğunu gösterir. Lütfen GOOGLE_FORM_URL'yi kontrol edin. Hata: ${error.message}`;
        showAlert(detailedErrorMsg, false);
    });
});

/**
 * Sheets verisindeki nesneleri (JSON'dan gelen) işleyerek rapor dizisine dönüştürür.
 * Data.json'dan gelen verinin işlenmesi.
 */
function processReportsFromJSON(data) {
    let rawReports = data; 
    
    // JSON yapısı kontrolü: Düz dizi veya 'reports' anahtarı içeren nesne
    if (!Array.isArray(data) && data && data.reports && Array.isArray(data.reports)) {
        console.warn("JSON kök yapısı nesne olarak algılandı. 'reports' dizisi kullanılacak.");
        rawReports = data.reports;
    } else if (!Array.isArray(data)) {
         console.error("JSON verisi ne düz bir dizi ne de 'reports' anahtarı içeren bir nesne. İşlenemiyor.");
         return [];
    }

    const reports = [];
    
    // Sheets'teki sütun başlıklarınızla eşleşen sabitler:
    const timestampCol = 'Zaman damgası';
    const ispCol = 'ISP'; 
    const ilCol = 'İl';
    const ilceCol = 'İlçe';
    const tahminiBitisCol = 'Bitiş Saati'; 
    const kesintiTarihiCol = 'Kesinti Tarihi';

    if (rawReports.length === 0) {
        return [];
    }

    for (const entry of rawReports) {
        // Gerekli alanların varlığını kontrol et ve değerleri al
        const isp = entry[ispCol];
        const timestamp = entry[timestampCol]; 
        const il = entry[ilCol];
        const ilce = entry[ilceCol];
        const tahminiBitisSaati = entry[tahminiBitisCol]; 
        const kesintiTarihi = entry[kesintiTarihiCol]; 

        if (isp && timestamp && kesintiTarihi) {
            let start = null;
            let end = null;
            
            try {
                // 1. BAŞLANGIÇ ZAMANI (Formun Zaman Damgası: GG.AA.YYYY HH:mm:ss)
                const [datePart, timePart] = timestamp.split(' ');
                const [day, month, year] = datePart.split('.');
                
                // Başlangıç tarihi için ISO formatına çevir ve Date nesnesini oluştur
                const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart.split(':').slice(0, 2).join(':')}:00`;
                start = new Date(isoDate).toISOString();
                
                if (tahminiBitisSaati) {
                    // 2. BİTİŞ ZAMANI (kesintiTarihiCol ve tahminiBitisCol'u birleştirerek)
                    const [kesintiGun, kesintiAy, kesintiYil] = kesintiTarihi.split('.');
                    
                    // Tahmini bitiş saati (örn: "17:00") kesinti tarihi ile birleştirilir.
                    let endDt = new Date(`${kesintiYil}-${kesintiAy.padStart(2, '0')}-${kesintiGun.padStart(2, '0')}T${tahminiBitisSaati}:00`);
                    
                    // Bitiş saati, başlangıç saatinden küçükse (bir sonraki gün kesinti bitti demektir), günü bir artırırız.
                    if (endDt.getTime() < new Date(start).getTime()) {
                        endDt.setDate(endDt.getDate() + 1);
                    }
                    end = endDt.toISOString();
                }
            } catch (e) {
                console.warn("Tarih/Saat ayrıştırma hatası:", e, "Orijinal Değerler:", timestamp, tahminiBitisSaati, kesintiTarihi);
                continue; // Hatalı kaydı atla
            }

          reports.push({
            isp: isp,
            il: il,
            ilce: ilce,
            start: start,
            end: end 
          });
        }
    }
    return reports;
}


// JSON dosyasından veriyi çeken, işleyen ve tabloları güncelleyen ana fonksiyon
async function loadAndProcessSheetData() {
    const maxRetries = 3;
    let lastError = null;

    // Arayüzdeki istatistikleri ve leaderboard'ı sıfırla
    document.getElementById("totalReports").textContent = 0;
    document.getElementById("activeOutages").textContent = 0;
    document.getElementById("leaderboard").innerHTML = '<div class="leaderboard-item">Veri Yükleniyor...</div>';
    document.getElementById("topISP").innerHTML = '<div>Veri yok</div>';
    document.getElementById("topLOC").innerHTML = '<div>Veri yok</div>';


    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`Yerel JSON verisi yükleniyor (Deneme: ${attempt + 1}/${maxRetries})`);
            
            // Yerel JSON dosyasını çekiyoruz
            const res = await fetch(LOCAL_JSON_DATA_URL);
            
            if (!res.ok) {
                const statusText = res.statusText || "Bilinmeyen Durum";
                throw new Error(`Yerel veri yüklenemedi (Durum: ${res.status} - ${statusText}).`);
            }
            
            const jsonData = await res.json(); // JSON olarak oku
            
            const reports = processReportsFromJSON(jsonData);
            
            // Raporları işleyerek istatistikleri ve tabloları oluştur
            const activeOutages = reports.filter(r => r.end === null || (r.end && new Date(r.end) > new Date())).length;
            
            const processedData = {
                reports: reports,
                stats: {
                    totalReports: reports.length,
                    activeOutages: activeOutages
                }
            };

            // Tabloları güncelleyen ana fonksiyonu çağır
            updateLeaderboards(processedData);
            console.log("Veri başarıyla yüklendi ve işlendi. Toplam rapor:", reports.length);
            
            // Başarılı olursa döngüden çık
            return; 

        } catch (err) {
            lastError = err;
            console.warn(`Veri yükleme başarısız (Deneme ${attempt + 1}):`, err.message);
            if (attempt < maxRetries - 1) {
                // Yeniden denemeden önce bekle (Exponential backoff)
                const delay = Math.pow(2, attempt) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // Maksimum deneme sayısından sonra hala hata varsa kullanıcıya bildir
    console.error("Maksimum deneme sayısına ulaşıldı. Veri yüklenemedi:", lastError.message);
    showAlert(`Yerel Veri Hatası: data.json dosyasına erişilemedi veya formatı hatalı. Hata: ${lastError.message}`, false);
    
    // Veri yüklenemezse tabloyu boşalt
    document.getElementById("leaderboard").innerHTML = '<div>Veri yükleme başarısız.</div>';
}


function updateLeaderboards(data) {
  const lb = document.getElementById("leaderboard");
  lb.innerHTML = "";
  
  // Rapor sayısına göre ISP'leri sayan leaderboard
  const ispCounts = {};
  (data.reports || []).forEach(r => {
      ispCounts[r.isp] = (ispCounts[r.isp] || 0) + 1;
  });

  const sortedIspCounts = Object.entries(ispCounts)
    .map(([isp, count]) => ({ isp, count }))
    .sort((a, b) => b.count - a.count);

  (sortedIspCounts || []).forEach(item => {
    const div = document.createElement("div");
    div.className = "leaderboard-item";
    div.innerHTML = `<b>${item.isp}</b><span>${item.count} Bildirim</span>`;
    lb.appendChild(div);
  });
  
  if (sortedIspCounts.length === 0) {
      lb.innerHTML = '<div>Bildirim bulunmuyor.</div>';
  }

  // İstatistikleri güncelleme
  document.getElementById("totalReports").textContent =
    data.stats?.totalReports ?? 0;

  document.getElementById("activeOutages").textContent =
    data.stats?.activeOutages ?? 0;

  // En uzun kesinti süresine göre TOP 3
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
}


// ---- hesaplama fonksiyonları (değişmedi) ----
function calcMinutes(start, end) {
  const s = new Date(start);
  // Eğer 'end' (bitiş) tarihi boşsa (null), kesinti devam ediyor demektir, bu yüzden anlık zamanı (new Date()) kullanırız.
  const e = end ? new Date(end) : new Date(); 
  const diff = Math.round((e - s) / 60000); // Milisaniyeyi dakikaya çevir
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