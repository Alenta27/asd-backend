# Student Seeding Instructions

## How to Add the 10 Students to Your Database

### Prerequisites
- MongoDB must be running and connected
- A teacher account must exist in your database
- The backend server should have the correct MONGO_URI in `.env`

### Steps to Seed Students

1. **Ensure MongoDB is running**
   - If using local MongoDB: Start MongoDB service
   - If using MongoDB Atlas: Ensure your connection string is in `.env`

2. **Make sure you have a teacher account**
   - Log in to your application as a teacher
   - Or create a teacher account first

3. **Run the seeding script**
   ```bash
   cd backend
   node seedStudents.js
   ```

4. **Verify the students were added**
   - The script will output "Successfully seeded 10 students!"
   - Log in to the teacher dashboard and navigate to Student Management
   - You should see all 10 students listed

### Students That Will Be Added

1. **Rohan Sharma** - Age 7, 2nd Grade, Low Risk
2. **Priya Patel** - Age 9, 4th Grade, Medium Risk
3. **Aditya Singh** - Age 8, 3rd Grade, High Risk
4. **Ananya Reddy** - Age 6, 1st Grade, Low Risk
5. **Vikram Kumar** - Age 10, 5th Grade, Medium Risk
6. **Diya Gupta** - Age 7, 2nd Grade, Low Risk
7. **Arjun Menon** - Age 8, 3rd Grade, Medium Risk
8. **Aisha Khan** - Age 9, 4th Grade, Low Risk
9. **Karan Verma** - Age 6, 1st Grade, High Risk
10. **Sneha Desai** - Age 10, 5th Grade, Medium Risk

### Troubleshooting

**Error: "No teacher found"**
- Solution: Create a teacher account first by registering/logging in as a teacher

**Error: "connect ECONNREFUSED"**
- Solution: Ensure MongoDB is running or check your MONGO_URI in `.env`

**Students already exist**
- The script checks for existing students and won't duplicate them
- To re-seed, first delete existing students from the database



