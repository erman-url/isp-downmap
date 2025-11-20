// ===================================================================
// GOOGLE FORM VE TABLO ID'LERİ
// ===================================================================
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquQ/formResponse';
// Hata kaynağı olan URL. Hatanın büyük ihtimalle Apps Script ayarları veya CORS'tan kaynaklandığını unutmayın.
// Ancak kodu daha sağlam hale getiriyoruz.
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxUmXDjrKLJQDl3iknoi6a-leK_L5hEDVIUjV5bzsijdPwX0F9UA0LUVTScngVskOa/exec";

// GÜVENLİK - DİNAMİK CAPTCHA
let currentCaptchaAnswer = null;

// HARİTA MARKER'I İÇİN ÖZEL ICON TANIMI
const CustomIcon = L.icon({
    iconUrl: 'icon.png', // icon linkini güncelle
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
    kesintiTarihi: 'entry.888686904',
    baslangicSaati: 'entry.1555945811',
    bitisSaati: 'entry.126525220'
};

// HARİTA VE VERİ KONTROL DEĞİŞKENLERİ
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
// CAPTCHA FONKSİYONLARI
// ===================================================================
function generateCaptcha() {
    const num1 = Math.floor(Math.random() * 9) + 1;
    const num2 = Math.floor(Math.random() * 9) + 1;
    currentCaptchaAnswer = num1 + num2;
    const label = document.getElementById('captcha-label');
    if (label) label.textContent = `Güvenlik Sorusu: ${num1} + ${num2} = ?`;
    document.getElementById('captcha').value = '';
}

function checkCaptcha(answer) {
    return currentCaptchaAnswer !== null && Number(answer) === currentCaptchaAnswer;
}

// ===================================================================
// HARİTA FONKSİYONLARI
// ===================================================================
function isWithinTurkeyBounds(lat, lng) {
    const [minLat, minLng] = TURKEY_BOUNDS[0];
    const [maxLat, maxLng] = TURKEY_BOUNDS[1];
    return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

function initMap() {
    const mapDiv = document.getElementById('map');
    if (!mapDiv) return console.error("Harita div'i bulunamadı.");

    map = L.map('map', {
        center: TURKEY_CENTER,
        zoom: 6,
        minZoom: 6,
        maxBounds: TURKEY_BOUNDS,
        maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', onMapClick);
    realtimeMarkers.addTo(map);

    // İlk yükleme ve periyodik çekme
    fetchRealTimeMarkers();
    setInterval(fetchRealTimeMarkers, 60000); // 60 saniyede bir güncelle
}

function onMapClick(e) {
    const {lat, lng} = e.latlng;
    if (isWithinTurkeyBounds(lat, lng)) {
        updateMarkerAndFields(lat, lng);
    } else {
        if (marker) map.removeLayer(marker);
        marker = null;
        selectedCoords = null;
        document.getElementById('selected-location').innerText = 'Seçilen Konum: Belirtilmedi';
        document.getElementById('il').value = '';
        document.getElementById('ilce').value = '';
        L.popup().setLatLng(e.latlng).setContent("⚠️ Lütfen Türkiye sınırları içinde bir konum seçin.").openOn(map);
    }
}

function updateMarkerAndFields(lat, lng) {
    selectedCoords = {lat, lng};
    if (marker) marker.setLatLng([lat, lng]);
    else marker = L.marker([lat, lng], {icon: CustomIcon}).addTo(map).bindPopup("Kesinti Konumu").openPopup();
    document.getElementById('selected-location').innerText = `Seçilen Konum: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// ===================================================================
// VERİ ÇEKME & HARİTAYA EKLEME (ASYNC/AWAIT VE TRY/CATCH İLE GÜNCELLENDİ)
// ===================================================================
async function fetchRealTimeMarkers() {
    const statusDiv = document.getElementById('data-status');
    if (statusDiv) {
        statusDiv.textContent = 'Gerçek zamanlı veriler yükleniyor...';
        statusDiv.classList.remove('alert-success', 'alert-danger');
        statusDiv.classList.add('alert-warning');
    }

    try {
        const res = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            // mode: 'cors' kullanmak, tarayıcıda tam hata mesajını görmemizi sağlar, 
            // ancak CORS hatası alırsak yanıt işlenemez. Apps Script'i doğru yapılandırdığınızı varsayıyorum.
            mode: 'cors' 
        });

        // HTTP hatası (404, 500 vb.) varsa yakala
        if (!res.ok) {
            throw new Error(`HTTP Hatası: ${res.status} (${res.statusText || 'Sunucu hatası'})`);
        }

        // Yanıtın Content-Type başlığını kontrol et
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            // Eğer yanıt JSON değilse (örneğin HTML olarak geliyorsa)
            console.error("Beklenen Content-Type JSON değil:", contentType);
            throw new Error("Sunucudan beklenen JSON yerine farklı formatta yanıt alındı. Apps Script URL'sinin doğru şekilde JSON döndürdüğünden emin olun.");
        }

        const data = await res.json();

        if (!Array.isArray(data)) {
            throw new Error("Geçersiz veri formatı: Gelen veri bir dizi (Array) değil.");
        }

        // Son 24 saat filtresi
        const last24h = data.filter(d => 
            d.timestamp && 
            Date.now() - d.timestamp <= 24 * 60 * 60 * 1000 && 
            d.enlem && 
            d.boylam
        );
        
        updateMapMarkers(last24h);
        updateRealtimeTable(last24h); 

    } catch (err) {
        console.error("Veri çekme veya işleme hatası:", err);
        if (statusDiv) {
            // Hata mesajını daha kullanıcı dostu yap
            let displayMessage = err.message.includes("Failed to fetch") 
                ? "⚠️ Veri kaynağına (Apps Script) ulaşılamıyor. (CORS veya URL hatası olabilir)" 
                : `⚠️ Veri yüklenemedi: ${err.message}`;
                
            statusDiv.textContent = displayMessage;
            statusDiv.classList.remove('alert-warning', 'alert-success');
            statusDiv.classList.add('alert-danger');
        }
    }
}

function updateMapMarkers(filteredData) {
    realtimeMarkers.clearLayers();
    if (!map) return;

    if (filteredData.length === 0) {
        map.setView(TURKEY_CENTER, 6);
        return;
    }

    const bounds = L.latLngBounds([]);
    filteredData.forEach(item => {
        // Enlem ve Boylam değerlerini Number olarak kontrol et
        const lat = Number(item.enlem);
        const lng = Number(item.boylam);

        if (isFinite(lat) && isFinite(lng) && isWithinTurkeyBounds(lat, lng)) {
            const popup = `<strong>ISP:</strong> ${sanitizeInput(item.isp || '-')}<br>
                         <strong>Konum:</strong> ${sanitizeInput(item.ilce || '-')} / ${sanitizeInput(item.il || '-')}<br>
                         <strong>Tarih:</strong> ${new Date(item.timestamp).toLocaleString('tr-TR')}`;
            
            L.marker([lat, lng], {icon: CustomIcon}).bindPopup(popup).addTo(realtimeMarkers);
            bounds.extend([lat, lng]);
        }
    });

    if (bounds.isValid()) map.fitBounds(bounds.pad(0.1));
    else map.setView(TURKEY_CENTER, 6);
}

// ===================================================================
// TABLO GÖRÜNTÜLEME FONKSİYONU
// ===================================================================
function updateRealtimeTable(filteredData) {
    const tableBody = document.getElementById('realtime-table-body');
    const statusDiv = document.getElementById('data-status');

    if (!tableBody) return;

    // Tabloyu temizle
    tableBody.innerHTML = '';

    if (filteredData.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5; // 5 sütun olduğu için
        cell.textContent = "Son 24 saatte kayıtlı kesinti bulunmamaktadır.";
        cell.classList.add('text-center', 'text-muted');
        if (statusDiv) {
            statusDiv.textContent = 'Son 24 saat verileri yüklendi. (0 kayıt)';
            statusDiv.classList.remove('alert-warning');
            statusDiv.classList.add('alert-success');
        }
        return;
    }

    filteredData.forEach(item => {
        const row = tableBody.insertRow();
        
        // 1. Zaman Damgası
        row.insertCell().textContent = new Date(item.timestamp).toLocaleString('tr-TR');
        
        // 2. ISP
        row.insertCell().textContent = sanitizeInput(item.isp || '-');
        
        // 3. Konum (İlçe / İl)
        row.insertCell().textContent = `${sanitizeInput(item.ilce || '-')} / ${sanitizeInput(item.il || '-')}`;
        
        // 4. Başlangıç Saati
        row.insertCell().textContent = sanitizeInput(item.baslangicSaati || '-');
        
        // 5. Tahmini Bitiş Saati
        row.insertCell().textContent = sanitizeInput(item.bitisSaati || '-');
    });

    if (statusDiv) {
        statusDiv.textContent = `✅ Son 24 saat verileri yüklendi. (${filteredData.length} kayıt)`;
        statusDiv.classList.remove('alert-warning');
        statusDiv.classList.add('alert-success');
    }
}

// ===================================================================
// FORM İŞLEMLERİ
// ===================================================================
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#x27;','/':'&#x2F;'};
    return str.replace(/[&<>"'/]/g, m => map[m]);
}

function handleSubmit(e) {
    e.preventDefault();
    if (!selectedCoords) return alert("Haritadan konum seçin.");
    
    // İl ve İlçe alanlarının dolu olduğunu kontrol et (otomatik dolması beklense de)
    const il = document.getElementById('il').value;
    const ilce = document.getElementById('ilce').value;
    if (!il || !ilce) return alert("İl ve İlçe bilgileri henüz harita üzerinden alınamadı. Lütfen tekrar bir konum seçin.");

    const captcha = document.getElementById('captcha').value;
    if (!checkCaptcha(captcha)) return alert("Güvenlik sorusu (Captcha) hatalı.");
    
    const form = e.target;
    const formData = new FormData(form);
    
    // Gerekli koordinatları ekle
    formData.append(FORM_ENTRY_IDS.enlem, selectedCoords.lat);
    formData.append(FORM_ENTRY_IDS.boylam, selectedCoords.lng);

    // Form gönderme işlemi no-cors ile kalmalı, çünkü Google Form'un CORS başlığını kontrol edemeyiz
    fetch(GOOGLE_FORM_URL, {method:'POST', body:formData, mode:'no-cors'})
        .then(() => { 
            // Başarılı no-cors yanıtı (gerçek başarı form tarafından onaylanır)
            alert("✅ Kesinti bildirimi başarıyla gönderildi. Veriler haritada kısa sürede görünecektir."); 
            
            // Temizleme ve güncelleme
            form.reset(); 
            generateCaptcha(); 
            if(marker) map.removeLayer(marker); 
            document.getElementById('selected-location').innerText = 'Seçilen Konum: Belirtilmedi';
            
            // Verileri yeniden çek ve haritayı/tabloyu güncelle
            fetchRealTimeMarkers(); 
        })
        .catch(err => {
            console.error("Form gönderme hatası:", err);
            alert("Form gönderme işleminde bir hata oluştu. Lütfen tekrar deneyin.");
        });
}

// ===================================================================
// BAŞLANGIÇ
// ===================================================================
document.addEventListener('DOMContentLoaded', () => {
    generateCaptcha();
    initMap();
    const form = document.getElementById('kesinti-form');
    if (form) form.addEventListener('submit', handleSubmit);
    
    // Geriye dönük uyumluluk ve olası Apps Script hatası için
    if (typeof fetchRealTimeMarkers === 'undefined') {
        document.getElementById('data-status').textContent = '⚠️ Hata: Veri çekme fonksiyonu yüklenemedi.';
        document.getElementById('data-status').classList.remove('alert-warning');
        document.getElementById('data-status').classList.add('alert-danger');
    }
});
