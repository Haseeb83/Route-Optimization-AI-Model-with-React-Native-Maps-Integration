import numpy as np
import requests
import random
import json
from google.colab import files

# Q-learning parameters
GAMMA = 0.8
ALPHA = 0.5
EPSILON = 0.1  # For epsilon-greedy policy
EPISODES = 500  # Kept low to manage API calls

# OpenStreetMap Route API
OSM_API = "https://router.project-osrm.org/route/v1/walking/"
ELEVATION_API = "https://api.open-elevation.com/api/v1/lookup"

# Example waypoints in London, UK (lon, lat)
WAYPOINTS = [
    (-0.1278, 51.5074),  # Start: Trafalgar Square
    (-0.1330, 51.5140),  # Covent Garden
    (-0.1180, 51.5110),  # Leicester Square
    (-0.1410, 51.5150),  # Oxford Circus
    (-0.1750, 51.5150),  # End: Marble Arch
]
NUM_STATES = len(WAYPOINTS)

# Caches for API requests
route_cache = {}
elevation_cache = {}

# Function to get elevation data with caching
def get_cached_elevation(lat, lon):
    key = (lat, lon)
    if key in elevation_cache:
        return elevation_cache[key]
    
    try:
        response = requests.get(f"{ELEVATION_API}?locations={lat},{lon}")
        response.raise_for_status()
        elevation = response.json()["results"][0]["elevation"]
        elevation_cache[key] = elevation
        return elevation
    except requests.RequestException as e:
        print(f"Elevation API error: {e}")
    
    return 0

# Function to get route with caching
def get_cached_route(start_idx, end_idx):
    key = (start_idx, end_idx)
    if key in route_cache:
        return route_cache[key]
    
    start = f"{WAYPOINTS[start_idx][0]},{WAYPOINTS[start_idx][1]}"
    end = f"{WAYPOINTS[end_idx][0]},{WAYPOINTS[end_idx][1]}"
    url = f"{OSM_API}{start};{end}?overview=full&geometries=geojson"

    try:
        response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        if "routes" in data and data["routes"]:
            route_data = data["routes"][0]["geometry"]["coordinates"]
            route_cache[key] = route_data
            return route_data
    except requests.RequestException as e:
        print(f"OSM API error for {start} to {end}: {e}")
    
    return None

# Reward function with caching
def get_reward(start_idx, end_idx):
    route_data = get_cached_route(start_idx, end_idx)
    if route_data is None:
        return -100  # Large penalty for invalid routes
    
    elevation_changes = [get_cached_elevation(point[1], point[0]) for point in route_data]
    elevation_penalty = sum(abs(np.diff(elevation_changes)))
    return -len(route_data) - elevation_penalty

# Q-Table Initialization
Q_TABLE = np.zeros((NUM_STATES, NUM_STATES))

# Training with optimized exploration
def train_q_learning():
    for episode in range(EPISODES):
        state = 0  # Start at first waypoint (Trafalgar Square)
        visited_states = set()
        
        while state != NUM_STATES - 1:  # Goal is last waypoint (Marble Arch)
            possible_moves = [i for i in range(NUM_STATES) if i != state]
            
            if random.random() < EPSILON:
                next_state = random.choice(possible_moves)
            else:
                next_state = np.argmax(Q_TABLE[state])
            
            if next_state in visited_states:
                continue
            
            reward = get_reward(state, next_state)
            q_current = Q_TABLE[state, next_state]
            q_next = max(Q_TABLE[next_state])
            Q_TABLE[state, next_state] = q_current + ALPHA * (reward + GAMMA * q_next - q_current)
            
            visited_states.add(state)
            state = next_state
        
        if episode % 10 == 0:
            print(f"Episode {episode} completed")

# Train the model
train_q_learning()

print("Trained Q-Table with Elevation Data:")
print(Q_TABLE)

# Save Q-table to JSON file and download it
with open("q_table.json", "w") as f:
    json.dump(Q_TABLE.tolist(), f)
files.download("q_table.json")
print("Q-table saved and downloaded as q_table.json")