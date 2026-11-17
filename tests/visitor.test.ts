"use strict";

import "adaptive-extender/node";
import { describe, it, expect } from "vitest";
import { Visitor } from "../arena/models/visitor.js";

describe("Visitor", () => {
	it("limits a whole IPv6 /64 as one address", () => {
		const [address] = new Visitor("visitor", "2001:db8:aa:1::1").buckets();
		const [address2] = new Visitor("visitor", "2001:0DB8:00aa:0001:ffff:1:2:3").buckets();
		expect(address.key).toBe("address:2001:db8:aa:1::/64");
		expect(address2.key).toBe(address.key);
	});

	it("keeps another /64 apart", () => {
		const [address] = new Visitor("visitor", "2001:db8:aa:1::1").buckets();
		const [address2] = new Visitor("visitor", "2001:db8:aa:2::1").buckets();
		expect(address2.key).not.toBe(address.key);
	});

	it("expands a short form", () => {
		const [address] = new Visitor("visitor", "::1").buckets();
		expect(address.key).toBe("address:0:0:0:0::/64");
	});

	it("keeps an IPv4 address whole", () => {
		const [address] = new Visitor("visitor", "192.0.2.1").buckets();
		expect(address.key).toBe("address:192.0.2.1");
	});
});
