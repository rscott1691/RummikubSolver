from flask import Flask, render_template, request, jsonify, session
from set_generator import SetGenerator
from solver import RummikubSolver

app = Flask(__name__)
app.secret_key = 'rummikub-dev-key'

COLOURS = ['k', 'b', 'o', 'r']
COLOUR_NAMES = {'k': 'Black', 'b': 'Blue', 'o': 'Orange', 'r': 'Red'}


def build_tile_map(sg):
    verbose_list = [f'{COLOURS[c]}{n}' for c in range(sg.colours) for n in range(1, sg.numbers + 1)]
    verbose_list.append('j')
    tile_map = dict(zip(verbose_list, sg.tiles))
    r_tile_map = {v: k for k, v in tile_map.items()}
    return tile_map, r_tile_map


def get_sg_and_maps(variant):
    if variant == '6player':
        sg = SetGenerator(jokers=4)
    else:
        sg = SetGenerator()
    tile_map, r_tile_map = build_tile_map(sg)
    return sg, tile_map, r_tile_map


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/solve', methods=['POST'])
def solve():
    data = request.get_json()
    variant = data.get('variant', '4player')
    rack_codes = data.get('rack', [])
    table_codes = data.get('table', [])
    initial_meld = data.get('initial_meld', False)

    sg, tile_map, r_tile_map = get_sg_and_maps(variant)

    rack = [tile_map[c] for c in rack_codes if c in tile_map]
    table = [tile_map[c] for c in table_codes if c in tile_map]

    solver = RummikubSolver(tiles=sg.tiles, sets=sg.sets, rack=rack, table=table)
    value, tiles_played, sets_used = solver.solve(
        maximise='tiles',
        initial_meld=initial_meld
    )

    if value is None or value == 0 or (initial_meld and value < 30):
        return jsonify({'success': True, 'can_play': False, 'message': 'No valid move — pick up a tile.'})

    tile_list = [solver.tiles[i] for i in range(len(tiles_played)) if round(tiles_played[i]) == 1]
    set_list = [solver.sets[i] for i in range(len(sets_used)) if round(sets_used[i]) == 1]

    played_codes = [r_tile_map[t] for t in tile_list]
    sets_display = [[r_tile_map[t] for t in s] for s in set_list]

    return jsonify({
        'success': True,
        'can_play': True,
        'tiles_played': played_codes,
        'sets': sets_display,
        'tile_count': len(played_codes),
    })


if __name__ == '__main__':
    app.run(debug=True)
