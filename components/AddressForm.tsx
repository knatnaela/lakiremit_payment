'use client'

import { useState, useEffect } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import Select from 'react-select'
import { countries } from 'countries-list'
import { MapPin } from 'lucide-react'

// Client-only wrapper to prevent hydration mismatch
function ClientOnlySelect({ children }: any) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return (
      <div className="form-input" style={{ minHeight: '48px', display: 'flex', alignItems: 'center' }}>
        <span className="text-gray-400">Loading...</span>
      </div>
    )
  }

  return children
}

interface CountryOption {
  value: string
  label: string
  code: string
}

interface AddressFormProps {
  name?: string
  required?: boolean
  control?: any
  watch?: any
  setValue?: any
  errors?: any
}

export default function AddressForm({ 
  name = 'billing', 
  required = true,
  control: propControl,
  watch: propWatch,
  setValue: propSetValue,
  errors: propErrors
}: Readonly<AddressFormProps>) {
  const formContext = useFormContext()
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  
  // Use props if provided, otherwise fallback to context
  const control = propControl || formContext?.control
  const watch = propWatch || formContext?.watch
  const setValue = propSetValue || formContext?.setValue
  const errors = propErrors || formContext?.formState?.errors || {}
  
  const selectedCountry = watch ? watch(`${name}.country`) : undefined
  
  // Convert countries data to options format
  useEffect(() => {
    const options: CountryOption[] = Object.entries(countries).map(([code, country]) => ({
      value: code,
      label: `${country.name} (${code})`,
      code: code
    })).sort((a, b) => a.label.localeCompare(b.label))

    // Move common countries to the top
    const commonCountries = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX']
    const sortedOptions = [
      ...options.filter(option => commonCountries.includes(option.code)),
      { value: '', label: '──────────', code: '', isDisabled: true },
      ...options.filter(option => !commonCountries.includes(option.code))
    ]

    setCountryOptions(sortedOptions)
  }, [])

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <MapPin className="h-5 w-5 mr-2" />
        Billing Address
      </h3>

      {/* Country Selection */}
      <div className="mb-4">
        <label className="form-label">
          Country {required && '*'}
        </label>
        <Controller
          name={`${name}.country`}
          control={control}
          rules={{ required: required ? 'Country is required' : false }}
          render={({ field }) => (
            <ClientOnlySelect>
              <Select
                {...field}
                value={field.value ? countryOptions.find(option => option.value === field.value) || null : null}
                options={countryOptions}
                placeholder="Select a country..."
                className="react-select-container"
                classNamePrefix="react-select"
                isSearchable
                isClearable={false}
                filterOption={(option, inputValue) => {
                  if (!inputValue) {return true}
                  return option.label.toLowerCase().includes(inputValue.toLowerCase()) ||
                         option.value.toLowerCase().includes(inputValue.toLowerCase())
                }}
                noOptionsMessage={() => "No countries found"}
                loadingMessage={() => "Loading countries..."}
                onChange={(option) => {
                  field.onChange(option?.value || '')
                  // Clear state/province when country changes
                  setValue(`${name}.state`, '')
                }}
                styles={{
                  control: (provided) => ({
                    ...provided,
                    minHeight: '48px',
                    borderColor: errors[`${name}.country`] ? '#ef4444' : '#d1d5db',
                    '&:hover': {
                      borderColor: errors[`${name}.country`] ? '#ef4444' : '#9ca3af'
                    }
                  }),
                  option: (provided, state) => ({
                    ...provided,
                    backgroundColor: state.isSelected ? '#3b82f6' : state.isFocused ? '#f3f4f6' : 'white',
                    color: state.isSelected ? 'white' : '#374151',
                    cursor: 'pointer'
                  }),
                  menu: (provided) => ({
                    ...provided,
                    zIndex: 9999
                  }),
                  input: (provided) => ({
                    ...provided,
                    color: '#374151'
                  }),
                  placeholder: (provided) => ({
                    ...provided,
                    color: '#9ca3af'
                  })
                }}
              />
            </ClientOnlySelect>
          )}
        />
        {errors[`${name}.country`] && (
          <p className="form-error">{errors[`${name}.country`]?.message as string}</p>
        )}
      </div>

      {/* State/Province and City */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="form-label">
            State/Province {required && '*'}
          </label>
          <Controller
            name={`${name}.state`}
            control={control}
            rules={{ required: required ? 'State/Province is required' : false }}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className="form-input"
                placeholder={selectedCountry === 'US' ? 'NY' : 'State/Province'}
              />
            )}
          />
          {errors[`${name}.state`] && (
            <p className="form-error">{errors[`${name}.state`]?.message as string}</p>
          )}
        </div>

        <div>
          <label className="form-label">
            City {required && '*'}
          </label>
          <Controller
            name={`${name}.city`}
            control={control}
            rules={{ required: required ? 'City is required' : false }}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className="form-input"
                placeholder="City"
              />
            )}
          />
          {errors[`${name}.city`] && (
            <p className="form-error">{errors[`${name}.city`]?.message as string}</p>
          )}
        </div>
      </div>

      {/* Postal Code and Address */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="form-label">
            Postal Code {required && '*'}
          </label>
          <Controller
            name={`${name}.postalCode`}
            control={control}
            rules={{ required: required ? 'Postal code is required' : false }}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className="form-input"
                placeholder={selectedCountry === 'US' ? '12345' : 'Postal Code'}
              />
            )}
          />
          {errors[`${name}.postalCode`] && (
            <p className="form-error">{errors[`${name}.postalCode`]?.message as string}</p>
          )}
        </div>

        <div>
          <label className="form-label">
            Address {required && '*'}
          </label>
          <Controller
            name={`${name}.address`}
            control={control}
            rules={{ required: required ? 'Address is required' : false }}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className="form-input"
                placeholder="123 Main Street"
              />
            )}
          />
          {errors[`${name}.address`] && (
            <p className="form-error">{errors[`${name}.address`]?.message as string}</p>
          )}
        </div>
      </div>

      {/* Address Line 2 (Optional) */}
      <div>
        <label className="form-label">
          Address Line 2 (Optional)
        </label>
                  <Controller
            name={`${name}.address2`}
            control={control}
            render={({ field }) => (
              <input
                {...field}
                type="text"
                className="form-input"
                placeholder="Apartment, suite, etc. (optional)"
              />
            )}
          />
      </div>
    </div>
  )
} 