// Гоша — рабочий
import { buildPerson } from "./_person.js";

export default function build() {
	return buildPerson({ name: "gosha", skin: 0xf3c69a, hair: 0x7a4a26, hairStyle: "short", hat: "cap", hatColor: 0x2f78c4, shirt: 0xc8452e, overalls: true, pants: 0x3a4d73, shoes: 0x3a2a1e, scale: 1.05 });
}
