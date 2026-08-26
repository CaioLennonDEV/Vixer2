async function test() {
  const res = await fetch('https://caiolennondev.github.io/Vixer2/assets/index-O_u47094.js');
  const text = await res.text();
  console.log('BUNDLE LENGTH:', text.length);
  console.log('STARTS WITH:', text.slice(0, 150));
  console.log('CONTAINS MARKED IMPORT:', text.includes('marked'));
}
test();
