// farmer_portal.js - Fully working with Flask API integration

let crops = [];  // Will fetch from server
let cropsContainer, uploadBtn, uploadModal, cancelUpload, uploadForm;
let popupOverlay, closePopup;
let fName, fType, fQuality, fPrice, fQuantity, fDateTime, fImage, fNotes;
let popupImage, popupTitle, popupType, popupQuality, popupPrice, popupQuantity;
let popupDateTime, popupStatus, popupSold, popupNotes;

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    // DOM elements
    cropsContainer = document.getElementById('cropsContainer');
    uploadBtn = document.getElementById('uploadBtn');
    uploadModal = document.getElementById('uploadModal');
    cancelUpload = document.getElementById('cancelUpload');
    uploadForm = document.getElementById('uploadForm');
    popupOverlay = document.getElementById('popupOverlay');
    closePopup = document.getElementById('closePopup');

    fName = document.getElementById('cropName');
    fType = document.getElementById('cropType');
    fQuality = document.getElementById('cropQuality');
    fPrice = document.getElementById('cropPrice');
    fQuantity = document.getElementById('cropQuantity');
    fDateTime = document.getElementById('plantedDateTime');
    fImage = document.getElementById('cropImage');
    fNotes = document.getElementById('cropNotes');

    popupImage = document.getElementById('popupImage');
    popupTitle = document.getElementById('popupTitle');
    popupType = document.getElementById('popupType');
    popupQuality = document.getElementById('popupQuality');
    popupPrice = document.getElementById('popupPrice');
    popupQuantity = document.getElementById('popupQuantity');
    popupDateTime = document.getElementById('popupDateTime');
    popupStatus = document.getElementById('popupStatus');
    popupSold = document.getElementById('popupSold');
    popupNotes = document.getElementById('popupNotes');

    setupEventListeners();
    loadCropsFromServer();
}

function setupEventListeners() {
    uploadBtn.addEventListener('click', () => {
        clearForm();
        uploadForm.dataset.editingId = '';
        uploadModal.style.display = 'flex';
    });

    cancelUpload.addEventListener('click', () => uploadModal.style.display = 'none');
    closePopup.addEventListener('click', () => popupOverlay.style.display = 'none');

    uploadModal.addEventListener('click', e => { if (e.target === uploadModal) uploadModal.style.display = 'none'; });
    popupOverlay.addEventListener('click', e => { if (e.target === popupOverlay) popupOverlay.style.display = 'none'; });

    uploadForm.addEventListener('submit', handleFormSubmit);
}

// Fetch crops from backend
function loadCropsFromServer() {
    fetch('/api/crops')
        .then(res => res.json())
        .then(data => {
            crops = data.map(c => ({ ...c, id: c._id }));
            displayCrops();
        })
        .catch(err => console.error('Error loading crops:', err));
}

// Display crop cards
function displayCrops() {
    if (!cropsContainer) return;
    cropsContainer.innerHTML = '';

    if (!crops || crops.length === 0) {
        cropsContainer.innerHTML = '<p class="no-data">No crops found. Add a crop using "Upload Crop".</p>';
        return;
    }

    crops.forEach(crop => cropsContainer.appendChild(createCropCard(crop)));
}

function createCropCard(crop) {
    const card = document.createElement('div');
    card.className = 'crop-card';

    const img = document.createElement('img');
    img.className = 'crop-image';
    img.src = crop.image;
    img.alt = crop.name;
    img.addEventListener('click', () => showCropDetails(crop.id));

    const info = document.createElement('div');
    info.className = 'crop-info';
    info.innerHTML = `
        <h3>${crop.name}</h3>
        <p>Type: ${crop.type || '-'}</p>
        <p>Quality: ${crop.quality}</p>
        <p>Price: ₹${crop.price} / kg</p>
        <p>Qty: ${crop.quantity} kg</p>
    `;

    const actions = document.createElement('div');
    actions.className = 'crop-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', e => { e.stopPropagation(); editCrop(crop.id); });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', e => { e.stopPropagation(); deleteCrop(crop.id); });

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(img);
    card.appendChild(info);
    card.appendChild(actions);

    return card;
}

// Popup details
function showCropDetails(cropId) {
    const crop = crops.find(c => c.id === cropId);
    if (!crop) return;

    popupImage.src = crop.image;
    popupTitle.textContent = crop.name;
    popupType.textContent = crop.type || '-';
    popupQuality.textContent = crop.quality;
    popupPrice.textContent = '₹' + crop.price;
    popupQuantity.textContent = crop.quantity + ' kg';
    popupDateTime.textContent = formatDate(crop.datetime);
    popupStatus.textContent = crop.status;
    popupSold.textContent = crop.sold ? 'Yes' : 'No';
    popupNotes.textContent = crop.notes;

    popupOverlay.style.display = 'flex';
}

// Edit crop
function editCrop(cropId) {
    const crop = crops.find(c => c.id === cropId);
    if (!crop) return;

    fName.value = crop.name;
    fType.value = crop.type || 'vegetable';
    fQuality.value = crop.quality;
    fPrice.value = crop.price;
    fQuantity.value = crop.quantity;
    fDateTime.value = crop.datetime;
    fNotes.value = crop.notes;

    uploadForm.dataset.editingId = cropId;
    uploadModal.style.display = 'flex';
}

// Delete crop
function deleteCrop(cropId) {
    if (!confirm('Are you sure you want to delete this crop?')) return;

    fetch(`/api/crops/${cropId}`, { method: 'DELETE' })
        .then(res => res.json())
        .then(data => {
            console.log('Deleted:', data);
            loadCropsFromServer();
            alert('Crop deleted successfully!');
        })
        .catch(err => console.error('Error deleting crop:', err));
}

// Handle form submit (add/edit)
function handleFormSubmit(e) {
    e.preventDefault();
    if (!fName.value.trim()) return alert('Please enter crop name');

    const editingId = uploadForm.dataset.editingId || '';
    const cropData = {
        name: fName.value,
        type: fType.value,
        quality: fQuality.value,
        price: parseFloat(fPrice.value),
        quantity: parseFloat(fQuantity.value),
        datetime: fDateTime.value,
        status: 'Growing',
        sold: false,
        notes: fNotes.value || '',
        image: 'https://via.placeholder.com/300x200/4CAF50/FFFFFF?text=' + encodeURIComponent(fName.value)
    };

    if (fImage.files && fImage.files[0]) {
        const reader = new FileReader();
        reader.onload = event => {
            cropData.image = event.target.result;
            saveCropToServer(cropData, editingId);
        };
        reader.readAsDataURL(fImage.files[0]);
    } else {
        saveCropToServer(cropData, editingId);
    }
}

// Save crop via API
function saveCropToServer(crop, editingId) {
    const url = editingId ? `/api/crops/${editingId}` : '/api/crops';
    const method = editingId ? 'PUT' : 'POST';

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crop)
    })
    .then(res => res.json())
    .then(data => {
        console.log('Saved:', data);
        loadCropsFromServer();
        uploadModal.style.display = 'none';
        alert(editingId ? 'Crop updated successfully!' : 'Crop added successfully!');
    })
    .catch(err => console.error('Error saving crop:', err));
}

// Format date nicely
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    } catch (e) {
        return dateString;
    }
}

// Clear form
function clearForm() {
    uploadForm.reset();
    fDateTime.value = new Date().toISOString().slice(0,16);
}

// Expose globally
window.showCropDetails = showCropDetails;
window.editCrop = editCrop;
window.deleteCrop = deleteCrop;

console.log('Farmer Portal JS fully loaded with working add/edit/delete');
