import json

def get_smallest_timezone_area():
    with open('/Users/matthew_stand/code/world-clock/public/timezones.geojson', 'r') as f:
        data = json.load(f)
    min_area = float('inf')
    min_area_feature = None

    for feature in data['features']:
        geom = feature.get('geometry')
        if not geom:
            continue

        coords = geom['coordinates']
        min_lon, min_lat = float('inf'), float('inf')
        max_lon, max_lat = float('-inf'), float('-inf')

        # Handle both Polygon and MultiPolygon
        if geom['type'] == 'Polygon':
            polygons = [coords]
        elif geom['type'] == 'MultiPolygon':
            polygons = coords
        else:
            continue

        for poly in polygons:
            for ring in poly:
                for lon, lat in ring:
                    min_lon = min(min_lon, lon)
                    max_lon = max(max_lon, lon)
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)

        width = max_lon - min_lon
        height = max_lat - min_lat
        area = width * height

        if area > 0 and area < min_area:
            min_area = area
            min_area_feature = feature

    if min_area_feature:
        print(f"Smallest timezone area feature: {min_area_feature['properties'].get('tz_name1st')}")
        print(f"Bounding box area (degrees squared): {min_area}")
        min_lon, min_lat = float('inf'), float('inf')
        max_lon, max_lat = float('-inf'), float('-inf')
        geom = min_area_feature.get('geometry')
        coords = geom['coordinates']
        if geom['type'] == 'Polygon':
            polygons = [coords]
        else:
            polygons = coords
        for poly in polygons:
            for ring in poly:
                for lon, lat in ring:
                    min_lon = min(min_lon, lon)
                    max_lon = max(max_lon, lon)
                    min_lat = min(min_lat, lat)
                    max_lat = max(max_lat, lat)
        print(f"Bounding box: LON=[{min_lon}, {max_lon}], LAT=[{min_lat}, {max_lat}]")

get_smallest_timezone_area()