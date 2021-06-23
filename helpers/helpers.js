function filterOrders(orders, postcodes){
	const filtered = orders.filter((item => {
		let postcode = item["shipping_address"]["zip"]
		//console.log(postcode, postcode.replace(/\s/g, ""));
		return postcodes.some(prefix => postcode.startsWith(prefix) || postcode.replace(/\s/g, "").startsWith(prefix))
	})).map(item => ({ ...item, status: "Unpacked" }))
	console.log("Num filtered orders: ", filtered.length);
	return filtered
}

function updateStatuses(shopifyOrders, DBOrders) {
	return shopifyOrders.map(item => {
		let dbOrder = DBOrders.find(order => order.id === item.id)
		return dbOrder === undefined ? item : { ...item, status: dbOrder["status"]}
	})
}

function updateOrders(orders, id, status) {
	let index = orders.findIndex(o => o.id === id);
	let order = orders[index];
	let newOrder = {...order, status}
	orders.splice(index, 1, newOrder);
	return orders
}

function filterAndUpdateProducts(products, id, keys) {
	console.log(Object.keys(keys));
	//filter product by id
	let index = products.findIndex(p => p.id === id);
	let product = products[index];
	if ("status" in keys) {
		product = updateStatus(product, keys["status"]);
	}
	if ("quantity" in keys) {
		product = updateStock(product, keys["quantity"]);
	}
	products.splice(index, 1, product);
	return products;
}

function filterAndRemove(products, id){
	let index = products.findIndex(p => p.id === id);
	products.splice(index, 1);
	return products
}

function updateStatus(product, status) {
	return { ...product, status: status };
}

function updateStock(product, quantity) {
	console.log(quantity);
	product["variants"][0]["inventory_quantity"] = quantity;
	return product;
}

module.exports = {
	filterOrders,
	updateOrders,
	filterAndRemove,
	updateStatuses,
	filterAndUpdateProducts,
}