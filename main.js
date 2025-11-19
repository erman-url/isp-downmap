// ===================================================================
// GOOGLE FORM VE TABLO ID'LERİ
// ===================================================================
const DATA_SOURCE_URL = 'https://script.google.com/macros/s/AKfycbyBXAmcSHJ8e5jg8XgPmilhNmsfzfutNtv_K-yiErkeOZCWCWoh2lbyLOnNCD_07Syxn/exec'; 
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquE/formResponse';
const SPREADSHEET_ID = '1gMbbI0dUtwry8lEv-u2HpHf5hE9X74tTwiil886NQzK'; 
const SHEET_GID_REPORT = '800815817';

// GÜVENLİK - DİNAMİK CAPTCHA İÇİN DEĞİŞKEN
let currentCaptchaAnswer = null; 

// HARİTA MARKER'I İÇİN ÖZEL ICON TANIMI
const CustomIcon = L.icon({
    iconUrl: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi4z0BCtKjXZKLcT4UVf9vvPGwAHwBAn7enbRhVHkURDndCW_Thte3Sgt5YDb3iYUarlIyvFNqgrLd49ZWXLYRIUdNu0rDCahIrxuUNvt7z1eE3_OAtRn6kiIhW_o_i8MKRAJDCb3BFgIlbVdD9C0fNjHogoCk2-WeVuHp3dwT2zWeJGPog7LJE6B-dhcJc/s81/isp_mim.png',
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
    
    // HTML'de bu ID'nin var olduğundan emin olun!
    if (captchaLabel) {
        captchaLabel.textContent = `Güvenlik Sorusu: ${num1} + ${num2} = ?`;
    } else {
        console.warn("Captcha label ID'si (captcha-label) bulunamadı. HTML'i kontrol edin.");
    }

    document.getElementById('captcha').value = ''; // Input'u temizle
}


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
            if (!isWithinTurkeyBounds(item.
