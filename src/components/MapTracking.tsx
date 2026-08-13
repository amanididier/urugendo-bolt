"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom bus icon
const busIcon = new L.DivIcon({
  className: 'custom-bus-icon',
  html: '<div style="background:#00B85C;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">🚌</div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const terminalIcon = new L.DivIcon({
  className: 'custom-terminal-icon',
  html: '<div style="background:#F59E0B;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Rwanda coordinates
const RWANDA_CENTER: [number, number] = [-1.9403, 29.8739];

interface Location {
  name: string;
  position: [number, number];
  type: 'terminal' | 'bus';
}

interface MapTrackingProps {
  busLocation?: [number, number];
  route?: 'Kigali-Musanze' | 'Kigali-Huye' | 'Kigali-Rubavu';
  showRoute?: boolean;
}

export function MapTracking({ 
  busLocation = [-1.9536, 29.8755], // Default: near Kigali
  route = 'Kigali-Musanze',
  showRoute = true 
}: MapTrackingProps) {
  const [locations, setLocations] = useState<Location[]>([]);

  // Route coordinates (simplified for demo)
  const routeCoords: Record<string, [number, number][]> = {
    'Kigali-Musanze': [
      [-1.9536, 29.8755], // Kigali Nyabugogo
      [-1.9157, 29.7444], // Ruhengeri turn
      [-1.8768, 29.6123], // Byumba turn
      [-1.8356, 29.4800], // Gate of Heaven
      [-1.7978, 29.3500], // Kinigi
      [-1.7498, 29.2890], // Musanze
    ],
    'Kigali-Huye': [
      [-1.9536, 29.8755], // Kigali
      [-1.9300, 29.8500], // Kicukiro
      [-1.8900, 29.7800], // Bumbogo
      [-1.8500, 29.7000], // Nyamata
      [-1.8100, 29.6200], // Rwamagana
      [-1.7800, 29.5200], // Ngoma
      [-1.7600, 29.4500], // Huye
    ],
    'Kigali-Rubavu': [
      [-1.9536, 29.8755], // Kigali
      [-1.9300, 29.8500], // Kicukiro
      [-1.8900, 29.7800], // Bumbogo
      [-1.8500, 29.7200], // Rulindo
      [-1.7900, 29.6500], // Gicumbi
      [-1.7500, 29.5800], // Burambi
      [-1.7200, 29.5100], // Rubavu
    ],
  };

  useEffect(() => {
    const terminals: Location[] = [];
    
    if (route === 'Kigali-Musanze') {
      terminals.push({ name: 'Nyabugogo Terminal, Kigali', position: [-1.9536, 29.8755], type: 'terminal' });
      terminals.push({ name: 'Musanze Central Terminal', position: [-1.7498, 29.2890], type: 'terminal' });
    } else if (route === 'Kigali-Huye') {
      terminals.push({ name: 'Nyabugogo Terminal, Kigali', position: [-1.9536, 29.8755], type: 'terminal' });
      terminals.push({ name: 'Huye Bus Terminal', position: [-1.7600, 29.4500], type: 'terminal' });
    } else if (route === 'Kigali-Rubavu') {
      terminals.push({ name: 'Nyabugogo Terminal, Kigali', position: [-1.9536, 29.8755], type: 'terminal' });
      terminals.push({ name: 'Rubavu Terminal', position: [-1.7200, 29.5100], type: 'terminal' });
    }
    
    setLocations(terminals);
  }, [route]);

  return (
    <div className="relative rounded-xl overflow-hidden" style={{ height: '300px' }}>
      <MapContainer
        center={RWANDA_CENTER}
        zoom={10}
        style={{ height: '100%', width: '100%' }}
      >
        {/* OpenStreetMap - Free! */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route line */}
        {showRoute && (
          <Polyline positions={routeCoords[route]} color="#00B85C" weight={4} opacity={0.7} />
        )}
        
        {/* Bus marker */}
        <Marker position={busLocation} icon={busIcon}>
          <Popup>
            <div className="text-center">
              <p className="font-bold">🚌 Your Bus</p>
              <p className="text-sm">Volcano Express</p>
              <p className="text-xs text-gray-500">RAD 101A</p>
            </div>
          </Popup>
        </Marker>
        
        {/* Terminal markers */}
        {locations.filter(l => l.type === 'terminal').map((loc, i) => (
          <Marker key={i} position={loc.position} icon={terminalIcon}>
            <Popup>
              <p className="font-bold">{loc.name}</p>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Map controls overlay */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col gap-1">
        <button className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-lg">
          +
        </button>
        <button className="w-8 h-8 bg-white rounded-lg shadow-md flex items-center justify-center text-lg">
          −
        </button>
      </div>
    </div>
  );
}

// Location finder component for driver
export function LocationFinder() {
  const map = useMap();
  
  useMapEvents({
    click(e) {
      console.log('Clicked:', e.latlng);
    },
  });
  
  return null;
}