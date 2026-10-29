
import osmnx as ox

from router import RoadRouter


class RouteService:
    def __init__(self):
        self.router = RoadRouter()

    def nearest_node(self, latitude, longitude):
        return ox.distance.nearest_nodes(
            self.router.graph,
            X=longitude,
            Y=latitude,
        )

    def calculate_route(self, start_lat, start_lon, end_lat, end_lon):
        source = self.nearest_node(start_lat, start_lon)
        target = self.nearest_node(end_lat, end_lon)

        path = self.router.shortest_path(
            source,
            target,
            weight="time",
        )

        if not path:
            return None

        coordinates = self.router.path_coordinates(path)

        return {
            "source_node": source,
            "target_node": target,
            "path": path,
            "coordinates": coordinates,
            "distance_meters": self.router.path_distance_meters(path),
            "eta_seconds": self.router.path_travel_time_seconds(path),
        }