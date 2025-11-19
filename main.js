// ===================================================================
// GOOGLE FORM VE TABLO ID'LERİ
// ===================================================================
// ARTIK BU URL, KENDİ YAYINLANMIŞ APPS SCRIPT WEB UYGULAMANIZDIR.
const DATA_SOURCE_URL = 'https://script.google.com/macros/s/AKfycbyBXAmcSHJ8e5jg8XgPmilhNmsfzfutNtv_K-yiErkeOZCWCWoh2lbyLOnNCD_07Syxn/exec'; 


//const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquE/formResponse';
//const SPREADSHEET_ID = '1gMbbI0dUtwry8lEv-u2HpHf5hE9X74tTwiil886NQzK'; 
//const SHEET_GID = '800815817';

// 🚨 ÖNEMLİ: Bu URL'yi, 2. Bölümdeki talimatları izleyerek yayınladığınız KENDİ APPS SCRIPT URL'nizle DEĞİŞTİRİN!
const DATA_SOURCE_URL = 'https://script.google.com/macros/s/AKfyc.../exec'; // <--- SİZİN YENİ APPS SCRIPT URL'NİZİ BURAYA YAPIŞTIRIN!

const FORM_ENTRY_IDS = {
    isp: 'entry.1321343715',
    il: 'entry.1048550212',
    ilce: 'entry.1808925592',
    enlem: 'entry.119292663',
    boylam: 'entry.1923451466',
    aciklama: 'entry.1702812039',
    kesintiTarihi_year: 'entry.888686904_year',
    kesintiTarihi_month: 'entry.888686904_month',
    kesintiTarihi_day: 'entry.888686904_day',
    baslangicSaati_hour: 'entry.1555945811_hour',
    baslangicSaati_minute: 'entry.1555945811_minute',
    tahminiBitisSaati_hour: 'entry.126525220_hour',
    tahminiBitisSaati_minute: 'entry.126525220_minute'
};
// ===================================================================

let map;
let marker;
let realtimeMarkers = L.layerGroup();
let selectedCoords;

const TURKEY_CENTER = [39.9334, 32.8597];
const TURKEY_BOUNDS = [
    [35.8154, 25.567], 
    [42.100, 44.811]    
];

function isWithinTurkeyBounds(lat, lng) {
    const minLat = TURKEY_BOUNDS[0][0]; 
    const minLng = TURKEY_BOUNDS[0][1]; 
    const maxLat = TURKEY_BOUNDS[1][0]; 
    const maxLng = TURKEY_BOUNDS[1][1]; 

    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}


function initMap() {
    const mapDiv = document.getElementById('map');

    if (!mapDiv) {
        console.error("Harita div'i (#map) bulunamadı. Lütfen HTML yapısını kontrol edin.");
        return;
    }
    
    // HTML'deki integrity/crossorigin kaldırıldıktan sonra L tanımlı olmalı
    if (typeof L === 'undefined') {
        console.error("Leaflet kütüphanesi (L) yüklenemedi. HTML'deki Leaflet CDN bağlantılarını kontrol edin!");
        mapDiv.innerHTML = '<div style="color: red; text-align: center; padding: 50px;">⚠️ HATA: Harita Kütüphanesi Yüklenemedi (L is not defined).</div>';
        return;
    }


    try {
        map = L.map('map', {
            center: TURKEY_CENTER,
            zoom: 6,
            minZoom: 6,
            maxBounds: TURKEY_BOUNDS, 
            maxBoundsViscosity: 1.0
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        if (L.Control.Geocoder) {
            L.Control.geocoder({
                placeholder: "Adres, İl veya İlçe ara...",
                defaultMarkGeocode: false,
                collapsed: L.Browser.mobile,
                geocoder: L.Control.Geocoder.nominatim({
                    serviceUrl: 'https://nominatim.openstreetmap.org/search',
                    countrycodes: 'tr'
                })
            }).on('markgeocode', function(e) {
                const center = e.geocode.center;
                map.setView(center, 13);
                updateMarkerAndFields(center.lat, center.lng);
            }).addTo(map);
        } else {
             console.warn("Geocoder kütüphanesi yüklenemedi.");
        }
        

        map.on('click', onMapClick); 

        realtimeMarkers.addTo(map);

        fetchRealTimeMarkers();
        
        setInterval(fetchRealTimeMarkers, 60000); 

    } catch (e) {
        console.error("Leaflet veya Map başlatma sırasında beklenmedik hata:", e);
        mapDiv.innerHTML = '<div style="color: red; text-align: center; padding: 50px;">Beklenmedik bir harita hatası oluştu. Konsol mesajlarını kontrol edin.</div>';
    }
}

// GÜNCELLENDİ: Hatalı Enlem/Boylam verilerini ele almak için düzenlendi
function processSheetData(data) {
    const processedData = [];
    
    // İlk satır başlık olduğu için 1'den başlanır
    for (let i = 1; i < data.rows.length; i++) {
        const row = data.rows[i].c;
        
        let timestamp = null;
        let tahminiBitisSaati = null; 
        
        // Başlangıç Zaman Damgası
        if (row[0] && row[0].v) {
            const dateString = row[0].v.replace('Date(', '').replace(')', '');
            const parts = dateString.split(',').map(Number);
            if (parts.length >= 6) {
                // Not: Google Sheets, 0'dan başlayan ay indeksi (0=Ocak) döndürür.
                timestamp = new Date(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]).getTime();
            }
        }
        
        // Tahmini Bitiş Saati (8. sütun = index 7)
        if (row[7] && row[7].v) {
            tahminiBitisSaati = String(row[7].v);
        }

        // Enlem (index 4) ve Boylam (index 5) verilerini güvenli okuma ve bozuk veriyi ele alma
        let enlem = row[4] && row[4].v && !isNaN(Number(row[4].v)) ? Number(row[4].v) : null;
        let boylam = row[5] && row[5].v && !isNaN(Number(row[5].v)) ? Number(row[5].v) : null;

        // "undefined" stringini de yakala
        if (row[4] && String(row[4].v).toLowerCase() === 'undefined') enlem = null;
        if (row[5] && String(row[5].v).toLowerCase() === 'undefined') boylam = null;


        processedData.push({
            timestamp: timestamp,
            isp: row[1] ? String(row[1].v) : 'Bilinmiyor',
            il: row[2] ? String(row[2].v) : 'Bilinmiyor',
            ilce: row[3] ? String(row[3].v) : 'Bilinmiyor',
            enlem: enlem, 
            boylam: boylam, 
            tahminiBitisSaati: tahminiBitisSaati 
        });
    }
    return processedData;
}

function filterLast24Hours(allData) {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    // Enlem ve Boylam null olmayanları filtreler.
    return allData.filter(item => item.timestamp && item.timestamp >= twentyFourHoursAgo && item.enlem && item.boylam);
}

// GÜNCELLENDİ: Apps Script'ten gelen doğrudan JSON verisini okuyacak şekilde düzenlendi (CORS çözümü)
function fetchRealTimeMarkers() {
    document.getElementById('data-status').textContent = 'Gerçek zamanlı veriler yükleniyor...';

    // Artık Apps Script Proxy URL'sine gidiliyor
    fetch(DATA_SOURCE_URL)
        .then(response => {
            if (!response.ok) {
                // HTTP hatası varsa (404, 500 vb.)
                throw new Error(`HTTP Hata: ${response.status} (Apps Script'e ulaşılamadı)`);
            }
            // Doğrudan JSON yanıtı beklenir
            return response.json(); 
        })
        .then(data => {
            
            // Apps Script'ten hata objesi gelirse
            if (data.error || !data.table) {
                 throw new Error(`Apps Script Veri Hatası: ${data.error || 'Geçersiz tablo formatı.'}`);
            }

            const allData = processSheetData(data.table);
            const last24HoursData = filterLast24Hours(allData);

            updateMapMarkers(last24HoursData);
            updateLeaderboard(last24HoursData);
            createLatestReportsTable(last24HoursData); 
            updateGeneralStatistics(allData.length, last24HoursData.length); 

            document.getElementById('data-status').textContent = `Son 24 saatte ${last24HoursData.length} adet kesinti bildirimi haritada gösterildi. Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;
        })
        .catch(error => {
            console.error('Gerçek zamanlı veri çekme hatası:', error);
            // Hata mesajını daha anlaşılır yap
            document.getElementById('data-status').textContent = `⚠️ Veri yüklenirken kritik hata oluştu: ${error.message}. Lütfen Apps Script URL'sini ve Dağıtım ayarlarını kontrol edin.`;
            updateGeneralStatistics(0, 0); 
        });
}

function updateMapMarkers(filteredData) {
    realtimeMarkers.clearLayers();

    if (!map) return; 

    if (filteredData.length === 0) {
        map.setView(TURKEY_CENTER, 6);
        return;
    }
    
    let bounds = L.latLngBounds([]);

    filteredData.forEach(item => {
        if (item.enlem !== null && item.boylam !== null) {
            if (!isWithinTurkeyBounds(item.enlem, item.boylam)) {
                 return; 
            }

            const date = new Date(item.timestamp);
            const formattedDate = `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
            
            const safeIsp = sanitizeInput(item.isp);
            const safeIl = sanitizeInput(item.il);
            const safeIlce = sanitizeInput(item.ilce);


            const popupContent = `
                <strong>ISS:</strong> ${safeIsp}<br>
                <strong>Konum:</strong> ${safeIlce} / ${safeIl}<br>
                <strong>Bildirim Tarihi:</strong> ${formattedDate}
            `;

            const latLng = L.latLng(item.enlem, item.boylam);

            L.marker(latLng)
                .bindPopup(popupContent)
                .addTo(realtimeMarkers);

            bounds.extend(latLng);
        }
    });

    if (bounds.isValid()) {
        const validBounds = L.latLngBounds(TURKEY_BOUNDS);
        const effectiveBounds = validBounds.isValid() ? bounds.pad(0.1).intersect(validBounds) : bounds.pad(0.1);
        
        map.fitBounds(effectiveBounds, { padding: [20, 20], maxZoom: 13 });
    } else {
         map.setView(TURKEY_CENTER, 6);
    }
}

/**
 * Verilen verilerden sadece istenen sütunları içeren dinamik bir HTML tablosu oluşturur.
 * (Kalan fonksiyonlar (createLatestReportsTable, updateLeaderboard, updateGeneralStatistics, onMapClick, updateMarkerAndFields, getLocationFromCoords, sanitizeInput, sendDataToGoogleForm, showMessage, form event listener ve DOMContentLoaded) Kalanı Aynıdır)
 * ... (Aynı kalır) ...
 */

function createLatestReportsTable(data) {
    const tableDiv = document.getElementById('latest-reports-table');
    if (!tableDiv) return;

    const displayData = data.slice(0, 10); 
    
    if (displayData.length === 0) {
        tableDiv.innerHTML = '<p class="text-muted">Son 24 saat içinde gösterilecek bildirim verisi bulunamadı.</p>';
        return;
    }

    let tableHTML = `
        <table class="table table-striped table-sm">
            <thead>
                <tr>
                    <th>Zaman Damgası</th>
                    <th>ISP</th>
                    <th>İl</th>
                    <th>İlçe</th>
                    <th>Bşl. Saati</th>
                    <th>Bitiş Saati</th>
                </tr>
            </thead>
            <tbody>
    `;

    displayData.forEach(item => {
        const date = new Date(item.timestamp);
        
        const formattedTimestamp = date.toLocaleDateString('tr-TR') + ' ' + 
                                   date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

        const baslangicSaati = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        
        const bitisSaati = item.tahminiBitisSaati ? item.tahminiBitisSaati.substring(0, 5) : 'Bilinmiyor';

        tableHTML += `
            <tr>
                <td>${formattedTimestamp}</td>
                <td>${sanitizeInput(item.isp)}</td>
                <td>${sanitizeInput(item.il)}</td>
                <td>${sanitizeInput(item.ilce)}</td>
                <td>${baslangicSaati}</td>
                <td>${bitisSaati}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
        </table>
    `;

    tableDiv.innerHTML = tableHTML;
}

function updateLeaderboard(last24HoursData) {
    const leaderboardDiv = document.getElementById('leaderboard');
    const ispTotalDuration = {}; 

    last24HoursData.forEach(item => {
        const ispName = sanitizeInput(item.isp) || 'Bilinmiyor';
        
        let durationHours = 0;
        
        if (item.timestamp && item.tahminiBitisSaati) {
            const [bitisHourStr, bitisMinuteStr] = item.tahminiBitisSaati.split(':').map(s => s.padStart(2, '0'));

            const startTime = new Date(item.timestamp);
            
            let endTime = new Date(startTime.getFullYear(), startTime.getMonth(), startTime.getDate(),
                                     parseInt(bitisHourStr), parseInt(bitisMinuteStr), 0);
            
            if (endTime.getTime() < startTime.getTime()) {
                 endTime.setDate(endTime.getDate() + 1);
            }

            const durationMs = endTime.getTime() - startTime.getTime();
            
            durationHours = durationMs / (1000 * 60 * 60);
        }

        ispTotalDuration[ispName] = (ispTotalDuration[ispName] || 0) + durationHours;
    });

    const sortedIspDurations = Object.entries(ispTotalDuration)
        .sort(([, durationA], [, durationB]) => durationB - durationA);

    let leaderboardHTML = `<h3 class="leaderboard-title">En Çok Kesinti Süresi Olan ISP'ler (Son 24 Saat, Top 3)</h3>`;

    if (sortedIspDurations.length === 0) {
        leaderboardHTML += `<p>Son 24 saat içinde hesaplanabilir kesinti süresi olan bildirim yapılmamıştır.</p>`;
    } else {
        sortedIspDurations.slice(0, 3).forEach(([isp, totalHours], index) => {
            leaderboardHTML += `
                <div class="leaderboard-item">
                    <span class="rank-number">#${index + 1}</span>
                    <span class="isp-name">${isp}</span>
                    <span class="count">${totalHours.toFixed(1)} Saat</span>
                </div>
            `;
        });
    }

    leaderboardDiv.innerHTML = leaderboardHTML;
}

function updateGeneralStatistics(totalCount, activeCount) {
    const totalDiv = document.getElementById('total-reports');
    const activeDiv = document.getElementById('active-reports');

    if (totalDiv) {
         totalDiv.textContent = totalCount.toLocaleString('tr-TR');
    }

    if (activeDiv) {
         activeDiv.textContent = activeCount.toLocaleString('tr-TR');
    }
}

function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (isWithinTurkeyBounds(lat, lng)) {
        updateMarkerAndFields(lat, lng);
    } else {
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
        selectedCoords = null;
        document.getElementById('selected-location').innerText = 'Seçilen Konum: Belirtilmedi';
        document.getElementById('il').value = '';
        document.getElementById('ilce').value = '';
        
        L.popup()
            .setLatLng(e.latlng)
            .setContent("⚠️ Lütfen Türkiye sınırları içinde bir konum seçin.")
            .openOn(map);

        showMessage('Kesinti bildirimi için lütfen Türkiye haritası içinde bir nokta seçiniz.', 'danger');
    }
}

function updateMarkerAndFields(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        console.error('Geçersiz koordinatlar alındı.');
        return;
    }

    selectedCoords = { lat, lng };

    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        if (!map) return;
        marker = L.marker([lat, lng]).addTo(map)
            .bindPopup("Kesinti Konumu").openPopup();
    }

    document.getElementById('selected-location').innerText = `Seçilen Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    getLocationFromCoords(lat, lng);
}

function getLocationFromCoords(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;

    document.getElementById('il').value = 'Yükleniyor...';
    document.getElementById('ilce').value = 'Yükleniyor...';

    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Ters coğrafi kodlama HTTP hatası');
            }
            return response.json();
        })
        .then(data => {
            const address = data.address;

            let il = address.state || address.province || address.country_region || "Bilinmiyor";
            let ilce = address.county || address.state_district || address.city_district || address.city || address.town || address.village || "Bilinmiyor";

            il = sanitizeInput(il);
            ilce = sanitizeInput(ilce);

            if (ilce === il && ilce !== "Bilinmiyor") {
                 ilce = "Merkez İlçe / " + ilce;
            }
            
            if (il === "Turkey" || il === "Türkiye") {
                il = address.province || address.county || "Bilinmiyor";
            }

            document.getElementById('il').value = il;
            document.getElementById('ilce').value = ilce;
        })
        .catch(error => {
            console.error('Coğrafi kodlama hatası:', error);
            document.getElementById('il').value = 'Hata';
            document.getElementById('ilce').value = 'Hata';
            showMessage('Konum bilgisi alınamadı. Lütfen haritada daha spesifik bir nokta seçin.', 'danger');
        });
}

function sanitizeInput(text) {
    if (typeof text !== 'string') return text;
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    return text.replace(reg, (match)=>(map[match]));
}

function sendDataToGoogleForm(data) {
    const submitBtn = document.querySelector('.btn-submit');
    const messageDiv = document.getElementById('form-message');
    messageDiv.style.display = 'none';
    
    if (!selectedCoords || isNaN(data.enlem) || isNaN(data.boylam) || data.il === 'Hata' || data.ilce === 'Hata') {
         showMessage('Lütfen haritada geçerli bir konum seçin ve İl/İlçe bilgisinin otomatik dolmasını bekleyin.', 'danger');
         return;
    }


    submitBtn.disabled = true;
    submitBtn.textContent = 'Gönderiliyor...';


    const kesintiDate = new Date(data.kesintiTarihiRaw);
    
    const year = kesintiDate.getFullYear();
    const month = kesintiDate.getMonth() + 1; 
    const day = kesintiDate.getDate();

    const formattedMonth = month.toString().padStart(2, '0'); 
    const formattedDay = day.toString().padStart(2, '0');     
    
    const baslangicSaati_hour = kesintiDate.getHours().toString().padStart(2, '0');
    const baslangicSaati_minute = kesintiDate.getMinutes().toString().padStart(2, '0');
    const tahminiBitisSaati = data.tahminiBitisSaati;

    const sanitizedAciklama = sanitizeInput(data.aciklama);

    const formData = new URLSearchParams();

    formData.append(FORM_ENTRY_IDS.isp, sanitizeInput(data.isp));
    formData.append(FORM_ENTRY_IDS.il, sanitizeInput(data.il));
    formData.append(FORM_ENTRY_IDS.ilce, sanitizeInput(data.ilce));
    formData.append(FORM_ENTRY_IDS.enlem, data.enlem);
    formData.append(FORM_ENTRY_IDS.boylam, data.boylam);
    formData.append(FORM_ENTRY_IDS.aciklama, sanitizedAciklama);

    formData.append(FORM_ENTRY_IDS.kesintiTarihi_year, year);
    formData.append(FORM_ENTRY_IDS.kesintiTarihi_month, formattedMonth); 
    formData.append(FORM_ENTRY_IDS.kesintiTarihi_day, formattedDay); 

    formData.append(FORM_ENTRY_IDS.baslangicSaati_hour, baslangicSaati_hour);
    formData.append(FORM_ENTRY_IDS.baslangicSaati_minute, baslangicSaati_minute);

    if (tahminiBitisSaati) {
        const [hour, minute] = tahminiBitisSaati.split(':');
        formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_hour, hour);
        formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_minute, minute);
    }

    fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        mode: 'no-cors', 
        body: formData
    })
    .then(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Bildirimi Gönder';

        showMessage('Bildirim başarıyla gönderildi! Teşekkür ederiz.', 'success');
        document.getElementById('kesinti-form').reset();
        
        if(marker) {
            map.removeLayer(marker);
            marker = null;
        }
        selectedCoords = null;
        document.getElementById('selected-location').innerText = 'Seçilen Konum: Belirtilmedi';
        document.getElementById('il').value = '';
        document.getElementById('ilce').value = '';

        setTimeout(fetchRealTimeMarkers, 2000); 
    })
    .catch(error => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Bildirimi Gönder';

        console.error('Gönderim sırasında hata oluştu.', error);
        showMessage('Bildirim gönderilirken bir sorun oluştu (Ağ Hatası). Lütfen tekrar deneyin.', 'danger');
    });
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('form-message');
    messageDiv.textContent = message;
    messageDiv.className = `alert-message alert-${type}`;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 10000);
}

document.getElementById('kesinti-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const isp = document.getElementById('isp').value;
    const il = document.getElementById('il').value;
    const ilce = document.getElementById('ilce').value;
    const kesintiTarihiRaw = document.getElementById('kesintiTarihi').value;
    const tahminiBitisSaati = document.getElementById('tahminiBitisSaati').value;
    const aciklama = document.getElementById('aciklama').value;
    const captchaInput = parseInt(document.getElementById('captcha').value);

    if (captchaInput !== 8) {
        showMessage('Güvenlik Sorusu cevabı yanlış! Lütfen tekrar deneyin.', 'danger');
        return;
    }

    if (!selectedCoords || il === 'Bilinmiyor' || il === 'Hata' || ilce === 'Hata' || il === '' || ilce === '') {
        showMessage('Lütfen haritada geçerli bir konum seçin ve İl/İlçe bilgisinin dolmasını bekleyin.', 'danger');
        return;
    }

    const now = new Date();
    const selectedDate = new Date(kesintiTarihiRaw);

    if (selectedDate > now) {
         showMessage('Kesinti başlangıç tarihi ve saati gelecek bir zaman olamaz.', 'danger');
         return;
    }
    
    if (isp === '') {
        showMessage('Lütfen bir İnternet Servis Sağlayıcı seçin.', 'danger');
        return;
    }

    const data = {
        isp: isp,
        il: il,
        ilce: ilce,
        enlem: selectedCoords.lat,
        boylam: selectedCoords.lng,
        aciklama: aciklama,
        kesintiTarihiRaw: kesintiTarihiRaw,
        tahminiBitisSaati: tahminiBitisSaati
    };

    sendDataToGoogleForm(data);
});

document.addEventListener('DOMContentLoaded', initMap);