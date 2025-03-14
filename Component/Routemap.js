import React, { useState, useEffect } from 'react';
import { View, Button, Alert } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';

export default function RouteMap() {
    const [location, setLocation] = useState(null);
    const [route, setRoute] = useState([]);

    // Setting backend URL (use NGROK for real devices)
    const BACKEND_URL = "http://localhost:5000"; // Change to NGROK URL if needed

    // Get real-time user location
    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission to access location was denied");
                return;
            }
            let loc = await Location.getCurrentPositionAsync({});
            setLocation(loc.coords);
        })();
    }, []);

    const fetchOptimizedRoute = async () => {
        if (!location) {
            Alert.alert("Fetching GPS Location...");
            return;
        }

        const start = `${location.longitude},${location.latitude}`;
        const end = "-0.1278,51.5074"; // Sample destination: London, UK

        try {
            const response = await axios.post(`${BACKEND_URL}/get-route`, { start, end });
            console.log("API Response:", response.data);

            if (response.data.optimized_route) {
                setRoute(response.data.optimized_route.map(coord => ({
                    latitude: coord[1],
                    longitude: coord[0]
                })));
            } else {
                Alert.alert("No route found!");
            }
        } catch (error) {
            Alert.alert("Error fetching optimized route");
            console.error("API Error:", error);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <MapView
                style={{ flex: 1 }}
                showsUserLocation={true}
                initialRegion={{
                    latitude: location ? location.latitude : 51.5074,
                    longitude: location ? location.longitude : -0.1278,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }}
            >
                {location && <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }} title="Your Location" />}
                <Marker coordinate={{ latitude: 51.5074, longitude: -0.1278 }} title="Destination" />
                {route.length > 0 && <Polyline coordinates={route} strokeWidth={4} strokeColor="blue" />}
            </MapView>
            <Button title="Find Best Route" onPress={fetchOptimizedRoute} />
        </View>
    );
}
