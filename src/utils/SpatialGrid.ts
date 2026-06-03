export interface SpatialEntity {
  x: number;
  z: number;
  [key: string]: any;
}

export class SpatialGrid<T extends SpatialEntity> {
  private cellSize: number;
  private cells: Map<string, T[]> = new Map();

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private getCellKey(x: number, z: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cz = Math.floor(z / this.cellSize);
    return `${cx},${cz}`;
  }

  public clear(): void {
    this.cells.clear();
  }

  public insert(entity: T): void {
    const key = this.getCellKey(entity.x, entity.z);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key)!.push(entity);
  }

  public query(x: number, z: number, range: number): T[] {
    const results: T[] = [];
    // We compute the bounds of the query area in grid coordinates.
    const minCx = Math.floor((x - range) / this.cellSize);
    const maxCx = Math.floor((x + range) / this.cellSize);
    const minCz = Math.floor((z - range) / this.cellSize);
    const maxCz = Math.floor((z + range) / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = `${cx},${cz}`;
        const cell = this.cells.get(key);
        if (cell) {
          // Iterate over the cell instead of using spread to avoid max call stack size issues if cell is huge
          for (let i = 0; i < cell.length; i++) {
            results.push(cell[i]);
          }
        }
      }
    }
    return results;
  }
}
