// ===================================================================
// GOOGLE FORM VE TABLO ID'LERİ
// ===================================================================
const DATA_SOURCE_URL = 'https://script.google.com/macros/library/d/1bGP84v5jo7R5YD8yYBr11dEmmdl28XKJJtvbuBawEouYSQJFS2ieI6xc/3'; 
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquQ/formResponse';
const SPREADSHEET_ID = '1gMbbI0dUtwry8lEv-u2HpHf5hE9X74tTwiil886NQzK'; 
const SHEET_GID_REPORT = '800815817';
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxkp_feOiipwBBrHBGl3h9QlLzO6VIgwdot2wu4im3m9u3WIzVX6KHvGM-U4zPxw1vC/exec";


// GÜVENLİK - DİNAMİK CAPTCHA İÇİN DEĞİŞKEN
let currentCaptchaAnswer = null; 

// HARİTA MARKER'I İÇİN ÖZEL ICON TANIMI
const CustomIcon = L.icon({
    iconUrl: '#',
    iconSize: [40, 40], 
    iconAnchor: [20, 40], 
    popupAnchor: [0, -40] 
});

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

// ===================================================================
// GÜVENLİK VE CAPTCHA FONKSİYONLARI
// ===================================================================
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 9) + 1; 
    const num2 = Math.floor(Math.random() * 9) + 1; 
    currentCaptchaAnswer = num1 + num2;
    
    const captchaLabel = document.getElementById('captcha-label');
    
    if (captchaLabel) {
        captchaLabel.textContent = `Güvenlik Sorusu: ${num1} + ${num2} = ?`;
    } else {
        console.warn("Captcha label ID'si (captcha-label) bulunamadı. HTML'i kontrol edin.");
    }

    document.getElementById('captcha').value = ''; 
}

function checkCaptcha(answer) {
    // Captcha cevabının sayı olduğundan ve null olmadığından emin ol
    return currentCaptchaAnswer !== null && Number(answer) === currentCaptchaAnswer;
}


// ===================================================================
// HARİTA VE KONUM YÖNETİMİ
// ===================================================================

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
                    serviceUrl: 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10', 
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
        marker = L.marker([lat, lng], { icon: CustomIcon }).addTo(map)
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

            if (ilce === il && ilce !== "Bilinmiyor" && !ilce.includes("Merkez")) {
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

// ===================================================================
// VERİ ÇEKME VE HARİTAYA EKLEME
// ===================================================================

function processSheetData(data) {
    const processedData = [];
    
    for (let i = 1; i < data.rows.length; i++) {
        const row = data.rows[i].c;
        
        let timestamp = null;
        let tahminiBitisSaati = null; 
        
        if (row[0] && row[0].v) {
            const dateString = row[0].v.replace('Date(', '').replace(')', '');
            const parts = dateString.split(',').map(Number);
            if (parts.length >= 6) {
                timestamp = new Date(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5]).getTime();
            }
        }
        
        if (row[7] && row[7].v) {
            tahminiBitisSaati = String(row[7].v);
        }

        let enlem = row[4] && row[4].v && !isNaN(Number(row[4].v)) ? Number(row[4].v) : null;
        let boylam = row[5] && row[5].v && !isNaN(Number(row[5].v)) ? Number(row[5].v) : null;

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
    return allData.filter(item => item.timestamp && item.timestamp >= twentyFourHoursAgo && item.enlem && item.boylam);
}

function fetchRealTimeMarkers() {
    document.getElementById('data-status').textContent = 'Gerçek zamanlı veriler yükleniyor...';

    fetch(DATA_SOURCE_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP Hata: ${response.status} (Apps Script'e ulaşılamadı)`);
            }
            return response.json(); 
        })
        .then(data => {
            
            if (data.error || !data.table) {
                 throw new Error(`Apps Script Veri Hatası: ${data.error || 'Geçersiz tablo formatı.'}`);
            }

            const allData = processSheetData(data.table);
            const last24HoursData = filterLast24Hours(allData);

            updateMapMarkers(last24HoursData);
            createLatestReportsTable(last24HoursData); 
            updateGeneralStatistics(allData.length, last24HoursData.length); 

            document.getElementById('data-status').textContent = `Son 24 saatte ${last24HoursData.length} adet kesinti bildirimi haritada gösterildi. Son güncelleme: ${new Date().toLocaleTimeString('tr-TR')}`;
        })
        .catch(error => {
            console.error('Gerçek zamanlı veri çekme hatası:', error);
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

            L.marker(latLng, { icon: CustomIcon })
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

// ===================================================================
// FORM İŞLEMLERİ VE GÖNDERİM
// ===================================================================

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

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('form-message');
    if (messageDiv) {
        messageDiv.className = `alert alert-${type}`;
        messageDiv.innerHTML = message;
        messageDiv.style.display = 'block';
        
        // Birkaç saniye sonra mesajı temizle
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 8000);
    }
}

function sendDataToGoogleForm(formData) {
    const submitBtn = document.querySelector('.btn-submit');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Gönderiliyor...';

    fetch(GOOGLE_FORM_URL, {
        method: 'POST',
        body: formData,
        mode: 'no-cors' 
    })
    .then(() => {
        showMessage('✅ Bildiriminiz başarıyla kaydedildi! Teşekkür ederiz.', 'success');
        document.getElementById('kesinti-form').reset();
        generateCaptcha(); // Yeni captcha oluştur
        selectedCoords = null; // Koordinatları sıfırla
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
        document.getElementById('selected-location').innerText = 'Seçilen Konum: Belirtilmedi';
    })
    .catch(error => {
        console.error('Form gönderme hatası:', error);
        showMessage('⚠️ Bildirim gönderilirken bir hata oluştu. Lütfen tekrar deneyin.', 'danger');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Bildirimi Gönder';
    });
}


function handleSubmit(event) {
    event.preventDefault();
    const form = event.target;
    
    // 1. Konum Kontrolü
    if (!selectedCoords) {
        showMessage('Lütfen harita üzerinde kesintinin yaşandığı konumu seçin.', 'danger');
        return;
    }

    // 2. Captcha Kontrolü
    const captchaInput = document.getElementById('captcha');
    if (!checkCaptcha(captchaInput.value)) {
        showMessage('Hatalı güvenlik kodu (Captcha). Lütfen tekrar deneyin.', 'danger');
        generateCaptcha(); // Yeni Captcha oluştur
        captchaInput.value = '';
        return;
    }

    // 3. Tarih/Saat Ayırma ve Form Data Oluşturma
    const kesintiTarihiTime = document.getElementById('kesintiTarihi').value; 
    const [datePart, timePart] = kesintiTarihiTime.split('T'); 
    const [year, month, day] = datePart.split('-');
    const [hour, minute] = timePart.split(':');

    const tahminiBitisSaati = document.getElementById('tahminiBitisSaati').value;
    let tahminiBitisHour = '';
    let tahminiBitisMinute = '';

    if (tahminiBitisSaati) {
        [tahminiBitisHour, tahminiBitisMinute] = tahminiBitisSaati.split(':');
    }

    const formData = new FormData();
    
    // Konum verileri
    formData.append(FORM_ENTRY_IDS.enlem, selectedCoords.lat);
    formData.append(FORM_ENTRY_IDS.boylam, selectedCoords.lng);

    // Diğer form verileri
    formData.append(FORM_ENTRY_IDS.isp, form.elements.isp.value);
    formData.append(FORM_ENTRY_IDS.il, form.elements.il.value);
    formData.append(FORM_ENTRY_IDS.ilce, form.elements.ilce.value);
    formData.append(FORM_ENTRY_IDS.aciklama, form.elements.aciklama.value);
    
    // Tarih/Saat verileri
    formData.append(FORM_ENTRY_IDS.kesintiTarihi_year, year);
    formData.append(FORM_ENTRY_IDS.kesintiTarihi_month, parseInt(month, 10)); // Ay 1-12
    formData.append(FORM_ENTRY_IDS.kesintiTarihi_day, day);
    formData.append(FORM_ENTRY_IDS.baslangicSaati_hour, hour);
    formData.append(FORM_ENTRY_IDS.baslangicSaati_minute, minute);

    // Tahmini Bitiş Saati (Opsiyonel)
    if (tahminiBitisSaati) {
        formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_hour, tahminiBitisHour);
        formData.append(FORM_ENTRY_IDS.tahminiBitisSaati_minute, tahminiBitisMinute);
    }


    sendDataToGoogleForm(formData);
}

// ===================================================================
// BAŞLANGIÇ İŞLEMLERİ (ENTRY POINT)
// ===================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM içeriği yüklendi. Harita, Captcha ve Form başlatılıyor...");
    
    // 1. Güvenliği (Captcha) Başlat
    generateCaptcha(); 
    
    // 2. Haritayı Başlat
    initMap(); 
    
    // 3. Form Gönderimini Dinle
    const form = document.getElementById('kesinti-form');
    if (form) {
        form.addEventListener('submit', handleSubmit);
    } else {
        console.error("Kesinti formu (kesinti-form) bulunamadı.");
    }
});






