// Петрович — рабочий
import { buildPerson } from "./_person.js";

export default function build() {
	return buildPerson({ name: "petrovich", skin: 0xeab48a, hair: 0x9a9a9a, hairStyle: "short", hat: "hardhat", hatColor: 0xf2c21b, beard: "moustache", beardColor: 0xa8a8a8, shirt: 0x3d6a9e, pants: 0x2f3a4f, shoes: 0x3a2a1e, scale: 0.98 });
}
