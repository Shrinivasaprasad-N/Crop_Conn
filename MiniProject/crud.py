from bson.objectid import ObjectId
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

# --- Users ---

def get_user_by_email(email):
    return db.users.find_one({"email": email})

def get_user_by_id(user_id):
    return db.users.find_one({"_id": ObjectId(user_id)})

def create_user(user_data):
    return db.users.insert_one(user_data)

# --- Crops ---

def create_crop(crop_data):
    crop_data["datetime"] = crop_data.get("datetime", datetime.utcnow().isoformat())
    return db.crops.insert_one(crop_data)

def get_crops():
    return list(db.crops.find())

def get_crop(crop_id):
    return db.crops.find_one({"_id": ObjectId(crop_id)})

def update_crop(crop_id, crop_data):
    # Ensure crop_data does not contain _id (Mongo forbids updating that)
    crop_data.pop("_id", None)
    return db.crops.update_one(
        {"_id": ObjectId(crop_id)},
        {"$set": crop_data}
    )

def delete_crop(crop_id):
    return db.crops.delete_one({"_id": ObjectId(crop_id)})

# --- Bids ---

def place_bid(bid_data):
    return db.bids.insert_one(bid_data)

def get_bids_for_crop(crop_id):
    return list(db.bids.find({"crop_id": ObjectId(crop_id)}).sort("bid_price", -1))

def get_highest_bid(crop_id):
    bids = get_bids_for_crop(crop_id)
    return bids[0] if bids else None

# --- Auction Winners ---

def set_auction_winner(crop_id, user_id):
    db.auction_winners.update_one(
        {"crop_id": ObjectId(crop_id)},
        {"$set": {"user_id": ObjectId(user_id)}},
        upsert=True
    )

def get_auction_winner(crop_id):
    return db.auction_winners.find_one({"crop_id": ObjectId(crop_id)})
