// Сеня-тракторист, первый рабочий
import { buildPerson } from "./_person.js";

export default function build() {
	return buildPerson({ name: "senya", skin: 0xf0c08e, hair: 0x7a4a26, hairStyle: "short", hat: "capBack", hatColor: 0xc8402e, shirt: 0xe07a2a, pants: 0x4a4e57, shoes: 0x3a2a1e });
}
