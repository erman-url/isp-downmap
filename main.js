// ===================================================================
// GOOGLE FORM VE TABLO ID'LERİ
// ===================================================================
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/u/0/d/e/1FAIpQLScegs6ds3HEEFHMm-IMI9aEnK3-Otz-LKpqKYnmyWQ9B7zquQ/formResponse';
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyLfWxG8I-Fa5lYFKrqOjHJ3-iUCV6AcreaQDQv7Uhpf5pdv3C52w4JP9vGGf7T31qh/exec";

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

    fetchRealTimeMarkers();
    setInterval(fetchRealTimeMarkers, 60000);
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
        L.popup().setLatLng(
