// Вика — ветеринар
import { buildPerson } from "./_person.js";

export default function build() {
	return buildPerson({ name: "vika", skin: 0xf6cfa8, hair: 0xf0cd5a, hairStyle: "bob", coat: 0xf7f7f4, shirt: 0x3fae74, pants: 0x3fae74, shoes: 0xf0f0ea, scale: 0.96 });
}
