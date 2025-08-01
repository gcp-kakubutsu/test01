import net from 'net';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const host = process.env.DB_HOST || '';
const port = parseInt(process.env.DB_PORT || '3306');

console.log(`Testing connectivity to MySQL server...`);
console.log(`Host: ${host}`);
console.log(`Port: ${port}\n`);

// Test TCP connection first
const socket = new net.Socket();

socket.setTimeout(10000); // 10 second timeout

socket.on('connect', () => {
  console.log('✅ TCP connection successful!');
  console.log('The database server is reachable on the network level.');
  console.log('\nNote: If the MySQL connection still fails, it might be due to:');
  console.log('- Invalid credentials');
  console.log('- Database name doesn\'t exist');
  console.log('- User doesn\'t have permissions');
  socket.destroy();
});

socket.on('timeout', () => {
  console.log('❌ Connection timed out');
  console.log('\nPossible reasons:');
  console.log('- The host is not reachable from your network');
  console.log('- Security group/firewall is blocking the connection');
  console.log('- The RDS instance might be in a private VPC');
  console.log('- You may need to connect through a VPN or bastion host');
  socket.destroy();
});

socket.on('error', (err) => {
  console.log('❌ Connection error:', err.message);
  console.log('\nThis usually means the host is not accessible from your current network.');
});

// Attempt to connect
socket.connect(port, host);