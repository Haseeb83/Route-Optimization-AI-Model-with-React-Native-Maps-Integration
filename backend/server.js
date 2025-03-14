import express, { json } from "express";
import axios from "axios";
import cors from "cors";
import { promises as fs } from "fs";
const app = express();
app.use(json()); // Ensure JSON parsing
app.use(cors());

// Load Q-table from file
let Q_TABLE;
async function loadQTable() {
    try {
        const data = await fs.readFile("q_table.json", "utf8");
        Q_TABLE = JSON.parse(data);
        console.log("Q-table loaded successfully.");
    } catch (error) {
        console.error("Error loading Q-table:", error);
    }
}
loadQTable();

// Sample waypoints in London, UK
const WAYPOINTS = [
    [-0.1278, 51.5074],  // Trafalgar Square
    [-0.1330, 51.5140],  // Covent Garden
    [-0.1180, 51.5110],  // Leicester Square
    [-0.1410, 51.5150],  // Oxford Circus
    [-0.1750, 51.5150],  // Marble Arch
];

// Route API
app.post("/get-route", async (req, res) => {
    console.log("Received request:", req.body); // Debugging log

    const { start, end } = req.body;

    // Validate request
    if (!start || !end) {
        return res.status(400).json({ error: "Missing 'start' or 'end' in request body" });
    }

    try {
        // Parse coordinates
        const [startLon, startLat] = start.split(",").map(Number);
        const [endLon, endLat] = end.split(",").map(Number);

        if (isNaN(startLon) || isNaN(startLat) || isNaN(endLon) || isNaN(endLat)) {
            return res.status(400).json({ error: "Invalid coordinates format. Use 'lon,lat' format." });
        }

        // Find closest waypoints
        const startIdx = findClosestWaypoint(startLon, startLat);
        const endIdx = findClosestWaypoint(endLon, endLat);

        // Use Q-table to find the best path
        const optimizedPath = getOptimizedPath(startIdx, endIdx);

        if (!optimizedPath.length) {
            return res.status(500).json({ error: "Failed to determine an optimized route" });
        }

        // Fetch full route coordinates
        const routeCoordinates = await fetchRouteCoordinates(optimizedPath);

        res.json({ optimized_route: routeCoordinates });
    } catch (error) {
        console.error("Error processing route:", error);
        res.status(500).json({ error: "Failed to fetch optimized route" });
    }
});

// Find closest waypoint to given coordinates
function findClosestWaypoint(lon, lat) {
    return WAYPOINTS.reduce((closestIdx, waypoint, idx) => {
        const dist = Math.hypot(waypoint[0] - lon, waypoint[1] - lat);
        return dist < Math.hypot(WAYPOINTS[closestIdx][0] - lon, WAYPOINTS[closestIdx][1] - lat) ? idx : closestIdx;
    }, 0);
}

// Use Q-table to find the optimal path
function getOptimizedPath(startIdx, endIdx) {
    if (!Q_TABLE || !Q_TABLE[startIdx]) {
        console.error("Q-table is not loaded properly.");
        return [];
    }

    const path = [startIdx];
    let currentIdx = startIdx;

    while (currentIdx !== endIdx && path.length < WAYPOINTS.length) {
        const nextIdx = Q_TABLE[currentIdx].indexOf(Math.max(...Q_TABLE[currentIdx]));
        if (nextIdx === currentIdx || path.includes(nextIdx)) break;
        path.push(nextIdx);
        currentIdx = nextIdx;
    }

    if (currentIdx !== endIdx) path.push(endIdx);
    return path;
}

// Fetch route coordinates from OpenStreetMap
async function fetchRouteCoordinates(path) {
    let fullRoute = [];
    for (let i = 0; i < path.length - 1; i++) {
        const start = `${WAYPOINTS[path[i]][0]},${WAYPOINTS[path[i]][1]}`;
        const end = `${WAYPOINTS[path[i + 1]][0]},${WAYPOINTS[path[i + 1]][1]}`;
        try {
            const response = await get(
                `https://router.project-osrm.org/route/v1/walking/${start};${end}?overview=full&geometries=geojson`
            );
            const coords = response.data.routes[0].geometry.coordinates;
            fullRoute = fullRoute.concat(coords);
        } catch (error) {
            console.error(`Error fetching route from ${start} to ${end}:`, error);
        }
    }
    return fullRoute;
}

app.listen(5000, () => console.log("✅ Server running on port 5000"));
