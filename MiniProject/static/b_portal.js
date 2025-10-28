// b_portal.js - Fetch crops from backend and handle bidder portal

let crops = []; // Will be fetched from server
let wishlist = JSON.parse(localStorage.getItem("wishlist")) || [];
const currentUser = JSON.parse(localStorage.getItem("loggedInUser")) || {};

// -------------------- UTILITY FUNCTIONS --------------------

// Check if bidding is over (1 hour after crop time)
function checkIfBiddingOver(bidTime) {
    const now = new Date();
    const biddingStartTime = new Date(bidTime);
    const biddingEndTime = new Date(biddingStartTime.getTime() + 60 * 60 * 1000);
    return now > biddingEndTime;
}

// Check if user is winner
function isUserWinner(cropId) {
    const winners = JSON.parse(localStorage.getItem("auctionWinners")) || {};
    return winners[cropId] === currentUser.email;
}

// Get winner of a crop
function getCropWinner(cropId) {
    const winners = JSON.parse(localStorage.getItem("auctionWinners")) || {};
    return winners[cropId];
}

// Filter crops visible to user
function getVisibleCrops(cropsList) {
    return cropsList.filter(crop => {
        const biddingOver = checkIfBiddingOver(crop.datetime || crop.time);
        if (!biddingOver) return true;
        if (isUserWinner(crop._id || crop.id)) return true;
        return false;
    });
}

// -------------------- DISPLAY FUNCTIONS --------------------

function displayCrops(list) {
    const container = document.getElementById("cropContainer");
    container.innerHTML = "";
    const now = new Date();

    const visibleCrops = getVisibleCrops(list);

    if (visibleCrops.length === 0) {
        container.innerHTML = `
            <div class="no-crops-message">
                <h3>No crops available for bidding</h3>
                <p>All active auctions have ended or no crops are currently listed.</p>
            </div>
        `;
        return;
    }

    visibleCrops.forEach(crop => {
        const cropId = crop._id || crop.id;
        const bidTime = new Date(crop.datetime || crop.time);
        const biddingOpen = now >= bidTime;
        const biddingOver = checkIfBiddingOver(crop.datetime || crop.time);
        const userIsWinner = isUserWinner(cropId);

        const card = document.createElement("div");
        card.className = "crop-card";

        let statusElement = '';
        if (biddingOver) {
            if (userIsWinner) {
                statusElement = '<div class="bid-status won">🎉 You Won This Bid!</div>';
            } else {
                statusElement = '<div class="bid-status lost">Bidding Closed</div>';
            }
        } else if (biddingOpen) {
            statusElement = `<button class="bid-btn open" onclick="startBidding('${cropId}')">Start Bidding</button>`;
        } else {
            statusElement = '<div class="bid-status not-started">Bidding Not Started</div>';
        }

        card.innerHTML = `
            <img src="${crop.image}" alt="${crop.name}" onclick="showDetails('${cropId}')">
            <h3>${crop.name}</h3>
            <div class="button-group">
                <button class="detail-btn" onclick="showDetails('${cropId}')">Details</button>
                <button class="wishlist-btn" onclick="addToWishlist('${cropId}')">+ Wishlist</button>
            </div>
            ${statusElement}
        `;
        container.appendChild(card);
    });
}

// Show crop details in popup
function showDetails(id) {
    const crop = crops.find(c => (c._id || c.id) == id);
    if (!crop) return;

    const biddingOver = checkIfBiddingOver(crop.datetime || crop.time);
    const userIsWinner = isUserWinner(id);

    document.getElementById("cropName").innerText = crop.name;
    document.getElementById("cropQuantity").innerText = crop.quantity;
    document.getElementById("cropQuality").innerText = crop.quality;
    document.getElementById("cropTime").innerText = new Date(crop.datetime || crop.time).toLocaleString();

    let statusHTML = "";
    if (biddingOver) {
        if (userIsWinner) {
            statusHTML = "<span style='color:green; font-weight: bold;'>🎉 Congratulations! You Won This Bid!</span>";
        } else {
            const winner = getCropWinner(id);
            if (winner) statusHTML = `<span style='color:red;'>Bidding Closed - Won by: ${winner}</span>`;
            else statusHTML = "<span style='color:red;'>Bidding Closed</span>";
        }
    } else if (new Date() >= new Date(crop.datetime || crop.time)) {
        statusHTML = "<span style='color:green;'>Bidding Open - Place your bid now!</span>";
    } else {
        statusHTML = "<span style='color:orange;'>Bidding Not Started</span>";
    }

    document.getElementById("biddingStatus").innerHTML = statusHTML;
    document.getElementById("detailsPopup").style.display = "flex";
}

function closePopup() {
    document.getElementById("detailsPopup").style.display = "none";
}

// -------------------- BIDDING & WISHLIST --------------------

function startBidding(id) {
    const crop = crops.find(c => (c._id || c.id) == id);
    if (!crop || checkIfBiddingOver(crop.datetime || crop.time)) {
        alert("Bidding for this crop has ended!");
        return;
    }
    localStorage.setItem("currentBidCrop", JSON.stringify(crop));
    // Use Flask route instead of static HTML path
    window.location.href = "/bid_portal";
}

function addToWishlist(id) {
    const crop = crops.find(c => (c._id || c.id) == id);
    if (!crop) return;
    if (checkIfBiddingOver(crop.datetime || crop.time)) {
        alert("Cannot add expired crops to wishlist!");
        return;
    }
    if (!wishlist.some(c => (c._id || c.id) == id)) {
        wishlist.push(crop);
        localStorage.setItem("wishlist", JSON.stringify(wishlist));
        alert(crop.name + " added to wishlist!");
    } else {
        alert("Already in wishlist!");
    }
}

// -------------------- SEARCH --------------------

document.getElementById("search").addEventListener("input", function() {
    const val = this.value.toLowerCase();
    const filtered = crops.filter(c => c.name.toLowerCase().includes(val));
    const visibleFilteredCrops = getVisibleCrops(filtered);
    displayCrops(visibleFilteredCrops);
});

// -------------------- FETCH CROPS FROM SERVER --------------------

async function fetchCrops() {
    try {
        const res = await fetch("/api/crops");
        if (!res.ok) throw new Error("Failed to fetch crops");
        crops = await res.json();
        displayCrops(crops);
    } catch (err) {
        console.error(err);
        document.getElementById("cropContainer").innerHTML = "<p>Error loading crops.</p>";
    }
}

document.addEventListener("DOMContentLoaded", fetchCrops);

// -------------------- AUCTION WINNER SIMULATION --------------------

function setAuctionWinner(cropId, winnerEmail) {
    const winners = JSON.parse(localStorage.getItem("auctionWinners")) || {};
    winners[cropId] = winnerEmail;
    localStorage.setItem("auctionWinners", JSON.stringify(winners));
}

// Make functions globally accessible
window.showDetails = showDetails;
window.closePopup = closePopup;
window.startBidding = startBidding;
window.addToWishlist = addToWishlist;
window.setAuctionWinner = setAuctionWinner;
