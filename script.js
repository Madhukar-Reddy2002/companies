// US States Array
const states = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
    'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 
    'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 
    'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 
    'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 
    'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 
    'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 
    'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

// DOM Elements
const businessNameInput = document.getElementById('businessName');
const companyNamesList = document.getElementById('companyNames');
const stateSelect = document.getElementById('state');
const industrySelect = document.getElementById('industry');
const foundedYearInput = document.getElementById('foundedYear');

// Populate State Dropdown
function populateStates() {
    states.forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateSelect.appendChild(option);
    });
}

// Load Companies
async function loadCompanies() {
    try {
        const response = await fetch('companies.json');
        const companies = await response.json();

        // Clear existing options
        companyNamesList.innerHTML = '';

        // Populate companies datalist
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.name;
            option.setAttribute('data-industry', company.industry);
            option.setAttribute('data-founded', company.founded);
            companyNamesList.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading companies:', error);
    }
}

// Auto-fill additional fields when a company is selected
businessNameInput.addEventListener('input', function() {
    const selectedOption = Array.from(companyNamesList.options).find(
        option => option.value === this.value
    );

    if (selectedOption) {
        // Auto-fill industry if available
        const industry = selectedOption.getAttribute('data-industry');
        if (industry) {
            industrySelect.value = industry;
        }

        // Auto-fill founded year if available
        const foundedYear = selectedOption.getAttribute('data-founded');
        if (foundedYear) {
            foundedYearInput.value = foundedYear;
        }
    }
});

// Form Submission Handler
document.getElementById('businessLoanForm').addEventListener('submit', function(e) {
    e.preventDefault();

    // Collect Form Data
    const formData = {
        businessName: document.getElementById('businessName').value,
        foundedYear: document.getElementById('foundedYear').value,
        industry: document.getElementById('industry').value,
        annualRevenue: document.getElementById('annualRevenue').value,
        requestedFunding: document.getElementById('requestedFunding').value,
        companyAddress: document.getElementById('companyAddress').value,
        state: document.getElementById('state').value,
        country: document.getElementById('country').value,
        ownerName: document.getElementById('ownerName').value,
        email: document.getElementById('email').value
    };

    // Basic Validation
    if (!formData.businessName || !formData.requestedFunding) {
        alert('Please fill in required fields');
        return;
    }

    // Log Form Data (Replace with actual submission logic)
    console.log('Loan Application Submitted:', formData);
    alert('Loan Application Submitted Successfully!');
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    populateStates();
    loadCompanies();
});