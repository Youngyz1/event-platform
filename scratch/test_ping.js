async function run() {
  try {
    const res = await fetch('http://localhost:3000/');
    console.log('Status of http://localhost:3000/:', res.status);
    const text = await res.text();
    console.log('Title/Content excerpt:', text.slice(0, 500));
  } catch (err) {
    console.error('Error connecting to localhost:3000:', err.message);
  }
}

run();
