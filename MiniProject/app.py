from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from bson.objectid import ObjectId
from datetime import datetime, timedelta
import bcrypt
import os

# Import CRUD operations from your custom module
from crud import (
    get_user_by_email, create_user, get_crops, create_crop,
    update_crop, delete_crop, get_crop, get_highest_bid,
    place_bid, get_auction_winner, db
)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# ------------------- BASIC ROUTES -------------------

@app.route("/", methods=["GET"])
def register():
    return render_template("register.html")

@app.route("/login", methods=["GET"])
def login():
    return render_template("login.html")

@app.route("/farmerportal")
def farmer_portal():
    return render_template("f_portal.html")

@app.route("/bidderportal")
def bidder_portal():
    return render_template("b_portal.html")

@app.route("/wishlist")
def wishlist_page():
    return render_template("wishlist.html")

@app.route('/bid_portal')
def bid_portal():
    return render_template('bidding/bid_portal.html')


# ------------------- AUTH APIs -------------------

@app.route("/api/auth/register", methods=["POST"])
def register_api():
    data = request.get_json()

    if not data or not all(k in data for k in ("username", "email", "password")):
        return jsonify({"error": "Missing required fields"}), 400

    if get_user_by_email(data["email"]):
        return jsonify({"error": "Email already exists"}), 400

    hashed_pw = bcrypt.hashpw(data["password"].encode(), bcrypt.gensalt())

    user = {
        "username": data["username"],
        "email": data["email"],
        "password": hashed_pw,
        "role": data.get("role", "bidder")
    }
    create_user(user)
    return jsonify({"message": "User registered successfully"}), 201


@app.route("/api/auth/login", methods=["POST"])
def login_api():
    data = request.get_json()
    if not data or not all(k in data for k in ("email", "password")):
        return jsonify({"error": "Missing credentials"}), 400

    user = get_user_by_email(data["email"])
    if not user or not bcrypt.checkpw(data["password"].encode(), user["password"]):
        return jsonify({"error": "Invalid credentials"}), 400

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": str(user["_id"]),
            "username": user["username"],
            "role": user["role"],
            "email": user["email"]
        }
    }), 200


# ------------------- CROPS -------------------
@app.route("/api/crops", methods=["GET"])
def list_crops():
    crops = get_crops()
    for c in crops:
        c["_id"] = str(c["_id"])
    return jsonify(crops), 200


@app.route("/api/crops", methods=["POST"])
def add_crop():
    if request.is_json:
        data = request.get_json()
    else:
        data = request.form.to_dict()
        # Convert numbers
        for key in ["price", "quantity"]:
            if key in data:
                data[key] = float(data[key])

    data["datetime"] = datetime.utcnow().isoformat()

    # Optional: handle file upload
    if "cropImage" in request.files:
        f = request.files["cropImage"]
        filepath = os.path.join("static/uploads", f.filename)
        f.save(filepath)
        data["image"] = filepath

    create_crop(data)
    return jsonify({"message": "Crop added successfully"}), 201


@app.route("/api/crops/<crop_id>", methods=["PUT"])
def edit_crop(crop_id):
    data = request.get_json()
    print("Incoming update for crop:", crop_id, data)
    result = update_crop(crop_id, data)
    print("MongoDB update result:", result.raw_result)
    if result.modified_count == 0:
        return jsonify({"error": "Crop not found"}), 404
    return jsonify({"message": "Crop updated"}), 200



@app.route("/api/crops/<crop_id>", methods=["DELETE"])
def remove_crop(crop_id):
    result = delete_crop(crop_id)
    if result.deleted_count == 0:
        return jsonify({"error": "Crop not found"}), 404
    return jsonify({"message": "Crop deleted"}), 200


# ------------------- BIDDING -------------------
@app.route("/api/bids/<crop_id>", methods=["POST"])
def bid(crop_id):
    data = request.get_json()
    crop = get_crop(crop_id)
    if not crop:
        return jsonify({"error": "Crop not found"}), 404

    crop_time = crop.get("datetime")
    if isinstance(crop_time, str):
        crop_time = datetime.fromisoformat(crop_time)

    bidding_end = crop_time + timedelta(hours=1)
    now = datetime.utcnow()

    if now > bidding_end:
        return jsonify({"error": "Bidding has ended"}), 400

    highest = get_highest_bid(crop_id)
    current_price = highest["bid_price"] if highest else crop["price"]

    if data["bid_price"] <= current_price:
        return jsonify({"error": "Bid must be higher than current price"}), 400

    place_bid({
        "crop_id": ObjectId(crop_id),
        "bidder_id": ObjectId(data["bidder_id"]),
        "bid_price": data["bid_price"],
        "timestamp": datetime.utcnow()
    })
    return jsonify({"message": "Bid placed successfully"}), 200


@app.route("/api/bids/highest/<crop_id>", methods=["GET"])
def highest_bid(crop_id):
    bid = get_highest_bid(crop_id)
    if bid:
        bid["_id"] = str(bid["_id"])
        bid["crop_id"] = str(bid["crop_id"])
        bid["bidder_id"] = str(bid["bidder_id"])
    return jsonify(bid), 200


# ------------------- WISHLIST -------------------
@app.route("/api/wishlist/<user_id>", methods=["GET"])
def get_wishlist(user_id):
    wishlist = db.wishlist.find({"user_id": ObjectId(user_id)})
    result = []
    for item in wishlist:
        item["_id"] = str(item["_id"])
        item["crop_id"] = str(item["crop_id"])
        item["user_id"] = str(item["user_id"])
        result.append(item)
    return jsonify(result), 200


@app.route("/api/wishlist", methods=["POST"])
def add_to_wishlist():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing wishlist data"}), 400
    exists = db.wishlist.find_one({
        "user_id": ObjectId(data["user_id"]),
        "crop_id": ObjectId(data["crop_id"])
    })
    if exists:
        return jsonify({"error": "Already in wishlist"}), 400
    db.wishlist.insert_one({
        "user_id": ObjectId(data["user_id"]),
        "crop_id": ObjectId(data["crop_id"]),
        "added_at": datetime.utcnow()
    })
    return jsonify({"message": "Added to wishlist"}), 201


# ------------------- AUCTION WINNER -------------------
@app.route("/api/auction/winner/<crop_id>", methods=["GET"])
def auction_winner(crop_id):
    winner = get_auction_winner(crop_id)
    if winner:
        winner["user_id"] = str(winner["user_id"])
        winner["crop_id"] = str(winner["crop_id"])
    return jsonify(winner), 200


if __name__ == "__main__":
    app.run(debug=True)
