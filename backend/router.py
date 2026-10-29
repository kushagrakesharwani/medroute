
import heapq
from pathlib import Path

import osmnx as ox


GRAPH_FILE = Path(__file__).parent / "data" / "mits_roads.graphml"

SPEED_KMH = {
    "primary": 50,
    "secondary": 40,
    "tertiary": 30,
    "residential": 25,
    "secondary_link": 25,
    "unclassified": 20,
    "living_street": 10,
}

DEFAULT_SPEED_KMH = 15


class RoadRouter:
    def __init__(self, graph_file=GRAPH_FILE):
        self.graph = ox.load_graphml(graph_file)

    def edge_travel_time_seconds(self, edge_data):
        """Estimate travel time for one road edge using its length and road type."""
        length_m = float(edge_data.get("length", 0))

        highway = edge_data.get("highway", "unknown")

        if isinstance(highway, list):
            speeds = [
                SPEED_KMH.get(str(road_type), DEFAULT_SPEED_KMH)
                for road_type in highway
            ]
            speed_kmh = min(speeds) if speeds else DEFAULT_SPEED_KMH
        else:
            speed_kmh = SPEED_KMH.get(
                str(highway),
                DEFAULT_SPEED_KMH,
            )

        if length_m < 0:
            raise ValueError("Road edge length cannot be negative.")

        speed_mps = speed_kmh / 3.6

        return length_m / speed_mps

    def _best_edge_data(self, source, target, weight="distance"):
        """
        Select the exact road edge used between two connected nodes.

        For distance routing, select the edge with the shortest distance.
        For time routing, select the edge with the lowest estimated travel time.
        """
        if weight not in ("distance", "time"):
            raise ValueError("weight must be 'distance' or 'time'")

        parallel_edges = self.graph[source][target]

        if not parallel_edges:
            raise ValueError(
                f"No road edges found between {source} and {target}."
            )

        if weight == "distance":
            return min(
                parallel_edges.values(),
                key=lambda data: float(
                    data.get("length", float("inf"))
                ),
            )

        return min(
            parallel_edges.values(),
            key=self.edge_travel_time_seconds,
        )

    def shortest_path(self, source, target, weight="distance"):
        """
        Find a route using Dijkstra's algorithm.

        weight='distance' finds the route with the lowest total distance.
        weight='time' finds the route with the lowest estimated travel time.

        Returns a list of graph node IDs, or an empty list if no route exists.
        """
        if weight not in ("distance", "time"):
            raise ValueError("weight must be 'distance' or 'time'")

        if source not in self.graph or target not in self.graph:
            return []

        if source == target:
            return [source]

        costs = {source: 0.0}
        previous = {}
        queue = [(0.0, source)]

        while queue:
            current_cost, current = heapq.heappop(queue)

            if current_cost > costs.get(current, float("inf")):
                continue

            if current == target:
                break

            for neighbor in self.graph[current]:
                edge_data = self._best_edge_data(
                    current,
                    neighbor,
                    weight,
                )

                if weight == "distance":
                    edge_cost = float(
                        edge_data.get("length", float("inf"))
                    )
                else:
                    edge_cost = self.edge_travel_time_seconds(edge_data)

                new_cost = current_cost + edge_cost

                if new_cost < costs.get(neighbor, float("inf")):
                    costs[neighbor] = new_cost
                    previous[neighbor] = current

                    heapq.heappush(
                        queue,
                        (new_cost, neighbor),
                    )

        if target not in costs:
            return []

        path = []
        current = target

        while current != source:
            path.append(current)

            if current not in previous:
                return []

            current = previous[current]

        path.append(source)
        path.reverse()

        return path

    def path_distance_meters(self, path, weight="distance"):
        """
        Calculate distance using the same edge-selection rule as the route.

        Pass the same weight used in shortest_path().
        """
        if weight not in ("distance", "time"):
            raise ValueError("weight must be 'distance' or 'time'")

        if not path or len(path) == 1:
            return 0.0

        total = 0.0

        for source, target in zip(path, path[1:]):
            edge_data = self._best_edge_data(
                source,
                target,
                weight,
            )

            total += float(
                edge_data.get("length", float("inf"))
            )

        return total

    def path_travel_time_seconds(self, path, weight="time"):
        """
        Calculate estimated travel time using the same edge-selection
        rule as the route.

        Pass the same weight used in shortest_path().
        """
        if weight not in ("distance", "time"):
            raise ValueError("weight must be 'distance' or 'time'")

        if not path or len(path) == 1:
            return 0.0

        total = 0.0

        for source, target in zip(path, path[1:]):
            edge_data = self._best_edge_data(
                source,
                target,
                weight,
            )

            total += self.edge_travel_time_seconds(edge_data)

        return total

    def path_coordinates(self, path, weight="time"):
        """
        Return Leaflet-compatible [latitude, longitude] coordinates
        using the same road edges selected by the routing weight.
        """
        if weight not in ("distance", "time"):
            raise ValueError("weight must be 'distance' or 'time'")

        if not path:
            return []

        if len(path) == 1:
            node = self.graph.nodes[path[0]]

            return [[
                float(node["y"]),
                float(node["x"]),
            ]]

        coordinates = []

        for source, target in zip(path, path[1:]):
            edge_data = self._best_edge_data(
                source,
                target,
                weight,
            )

            geometry = edge_data.get("geometry")

            if geometry is not None:
                edge_coordinates = [
                    [float(latitude), float(longitude)]
                    for longitude, latitude in geometry.coords
                ]

                # Ensure geometry follows the route's direction.
                source_node = self.graph.nodes[source]
                source_coordinate = [
                    float(source_node["y"]),
                    float(source_node["x"]),
                ]

                if (
                    edge_coordinates
                    and edge_coordinates[-1] == source_coordinate
                    and edge_coordinates[0] != source_coordinate
                ):
                    edge_coordinates.reverse()

            else:
                edge_coordinates = [
                    [
                        float(self.graph.nodes[source]["y"]),
                        float(self.graph.nodes[source]["x"]),
                    ],
                    [
                        float(self.graph.nodes[target]["y"]),
                        float(self.graph.nodes[target]["x"]),
                    ],
                ]

            # Avoid duplicating a shared endpoint between road segments.
            if (
                coordinates
                and edge_coordinates
                and coordinates[-1] == edge_coordinates[0]
            ):
                edge_coordinates = edge_coordinates[1:]

            coordinates.extend(edge_coordinates)

        return coordinates