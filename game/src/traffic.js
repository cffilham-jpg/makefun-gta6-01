// Ambient traffic: eighteen AI cars that cruise the city's road lanes in
// both directions, slowing to a stop when another car is ahead of them and
// wrapping around the map edges. They are ordinary vehicles with ai=true,
// so the police and the player's collisions treat them like any other car.
export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    const bodies = ['sedan', 'SUV', 'coupe', 'van', 'muscle', 'motorcycle'];
    const paints = ['#c07863', '#ddd3b6', '#679aa0'];
    for (let i = 0; i < 18; i++) {
      // Alternate east-west and north-south traffic across the road grid.
      const eastWest = i % 2 === 1;
      const lane = game.city.roads[(i * 3) % 7];
      const car = game.vehicles.spawn(
        bodies[i % bodies.length],
        eastWest ? -180 + i * 18 : lane + 4,
        eastWest ? lane - 4 : -180 + i * 19,
        eastWest ? Math.PI / 2 : 0,
        paints[i % 3]
      );
      car.ai = true;
      car.eastWest = eastWest;
      car.lane = lane;
      this.cars.push(car);
    }
  }

  update(dt) {
    const game = this.game;
    // Night traffic is thinner and slower than the daytime rush.
    const cruise = game.daynight.isNight ? 7 : 10;
    for (const car of this.cars) {
      if (!car.ai || car === game.player.car || car.hp <= 0) continue;
      // Look ahead in our own lane: stop when a car is close in front.
      let targetSpeed = cruise;
      for (const other of game.vehicles.all) {
        if (other === car) continue;
        const dx = other.p.x - car.p.x;
        const dz = other.p.z - car.p.z;
        const blocked = car.eastWest
          ? Math.abs(dz) < 2.7 && dx > 0 && dx < 10
          : Math.abs(dx) < 2.7 && dz > 0 && dz < 10;
        if (blocked) targetSpeed = 0;
      }
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 3);
      if (car.eastWest) car.p.x += car.speed * dt;
      else car.p.z += car.speed * dt;
      // Wrap around the far edge so traffic never runs out.
      if (car.p.x > 218) car.p.x = -215;
      if (car.p.z > 215) car.p.z = -215;
    }
  }
}
