const fs = require('fs/promises');
const readline = require('readline/promises');
const { stdin, stdout } = require('process');

const REGIONS = {
  spb: 'СПБ',
  msk: 'МСК',
  krd: 'КРД',
};

async function ask(rl, question, validate) {
  while (true) {
    const answer = (await rl.question(question)).trim();
    const check = validate(answer);

    if (check.ok) {
      return check.value;
    }

    console.log(check.error);
  }
}

function getPrice(product, region) {
  return product.prices[region];
}

function findCheapestInGroup(products, group, region) {
  const sameGroup = products.filter((item) => item.group === group);
  let cheapest = sameGroup[0];

  for (let i = 1; i < sameGroup.length; i++) {
    const item = sameGroup[i];
    if (getPrice(item, region) < getPrice(cheapest, region)) {
      cheapest = item;
    }
  }

  return cheapest;
}

function showCatalog(products, region) {
  console.log('');
  console.log('Каталог для региона ' + REGIONS[region] + ':');
  console.log('');

  for (const item of products) {
    const price = getPrice(item, region);
    console.log('[' + item.id + '] ' + item.name + ' | ' + item.category + ' | ' + price + ' руб.');
  }

  console.log('');
}

function showOrder(product, region, price) {
  console.log('');
  console.log('--- Заявка ---');
  console.log('Регион: ' + REGIONS[region]);
  console.log('Товар: ' + product.name);
  console.log('Категория: ' + product.category);
  console.log('Сумма: ' + price + ' руб.');
  console.log('');
}

async function writeOrder(region, product, price) {
  const order = {
    date: new Date().toISOString(),
    region: region,
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
    },
    price: price,
  };

  await fs.writeFile('order.json', JSON.stringify(order, null, 2));
  console.log('Готово, заявка лежит в order.json');
}

async function main() {
  const raw = await fs.readFile('data.json', 'utf-8');
  const products = JSON.parse(raw).products;

  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log('=== Заявка на строительные материалы ===');
    console.log('');
    console.log('Регионы: spb, msk, krd');

    const region = await ask(rl, 'Ваш регион: ', (input) => {
      if (REGIONS[input]) {
        return { ok: true, value: input };
      }
      return { ok: false, error: 'Такого региона нет, введите spb, msk или krd' };
    });

    showCatalog(products, region);

    const ids = products.map((p) => p.id);

    const pickedId = await ask(rl, 'ID товара: ', (input) => {
      const id = Number(input);

      if (!Number.isInteger(id) || !ids.includes(id)) {
        return { ok: false, error: 'Нет товара с таким ID, посмотрите список выше' };
      }

      return { ok: true, value: id };
    });

    const picked = products.find((p) => p.id === pickedId);
    let orderProduct = picked;
    let orderPrice = getPrice(picked, region);

    showOrder(orderProduct, region, orderPrice);

    const wantOrder = await ask(rl, 'Оформляем заявку? (y/n): ', (input) => {
      const answer = input.toLowerCase();
      if (answer === 'y' || answer === 'n') {
        return { ok: true, value: answer };
      }
      return { ok: false, error: 'Нужно y или n' };
    });

    if (wantOrder === 'n') {
      const cheaper = findCheapestInGroup(products, picked.group, region);

      if (cheaper.id === picked.id) {
        orderPrice = Math.round(orderPrice * 0.95);
        console.log('');
        console.log('Это самый дешёвый аналог («' + picked.group + '»).');
        console.log('Можем сделать скидку 5% — получится ' + orderPrice + ' руб.');
      } else {
        orderProduct = cheaper;
        orderPrice = getPrice(cheaper, region);
        console.log('');
        console.log('Есть аналог дешевле («' + picked.group + '»):');
        console.log(cheaper.name + ' — ' + orderPrice + ' руб.');
      }

      const ok = await ask(rl, 'Берём это предложение? (y/n): ', (input) => {
        const answer = input.toLowerCase();
        if (answer === 'y' || answer === 'n') {
          return { ok: true, value: answer };
        }
        return { ok: false, error: 'Нужно y или n' };
      });

      if (ok === 'n') {
        console.log('');
        console.log('Хорошо, заявка отменена.');
        return;
      }

      showOrder(orderProduct, region, orderPrice);
    }

    await writeOrder(region, orderProduct, orderPrice);
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error('Что-то пошло не так:', err.message);
  process.exit(1);
});
