
from pathlib import Path
import osmnx as ox

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = DATA_DIR / "mits_roads.graphml"

# Approximate coordinates for the MITS Gwalior area
CENTER = (26.2183, 78.1828)

print("Downloading road network around MITS Gwalior...")

graph = ox.graph_from_point(
    CENTER,
    dist=3000,
    network_type="drive",
    simplify=True,
)

ox.save_graphml(graph, filepath=OUTPUT_FILE)

print(f"Saved road network to: {OUTPUT_FILE}")
print(f"Road intersections/nodes: {len(graph.nodes)}")
print(f"Road segments/edges: {len(graph.edges)}")