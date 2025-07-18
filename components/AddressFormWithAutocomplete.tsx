'use client'

import { useState, useEffect, useRef } from 'react'
import { useFormContext, Controller } from 'react-hook-form'
import Select from 'react-select'
import { countries } from 'countries-list'
import { MapPin, Search } from 'lucide-react'

interface CountryOption {
  value: string
  label: string
  code: string
}

interface AddressFormProps {
  name?: string
  required?: boolean
  enableAutocomplete?: boolean
  googleApiKey?: string
}

declare global {
  // eslint-disable-next-line no-var
  var google: any;
}

export default function AddressFormWithAutocomplete({ 
  name = 'billing', 
  required = true,
  enableAutocomplete = false,
}: AddressFormProps) {
  const { control, watch, setValue, formState: { errors } } = useFormContext()
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  const selectedCountry = watch(`${name}.country`)
  const addressInputRef = useRef<HTMLInputElement>(null)

  // Convert countries data to options format
  useEffect(() => {
    const options: CountryOption[] = Object.entries(countries).map(([code, country]) => ({
      value: code,
      label: country.name,
      code: code
    })).sort((a, b) => a.label.localeCompare(b.label))

    // Move common countries to the top
    const commonCountries = ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'JP', 'IN', 'BR', 'MX', 'PH']
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
        {enableAutocomplete && (
          <span className="ml-2 text-sm text-blue-600 flex items-center">
            <Search className="h-4 w-4 mr-1" />
            Autocomplete enabled
          </span>
        )}
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
            <Select
              {...field}
              options={countryOptions}
              placeholder="Select a country..."
              className="react-select-container"
              classNamePrefix="react-select"
              isSearchable
              isClearable={false}
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
                  color: state.isSelected ? 'white' : '#374151'
                })
              }}
            />
          )}
        />
        {errors[`${name}.country`] && (
          <p className="form-error">{errors[`${name}.country`]?.message as string}</p>
        )}
      </div>

      {/* Address with Autocomplete */}
      <div className="mb-4">
        <label className="form-label">
          Address {required && '*'}
          {enableAutocomplete && (
            <span className="text-sm text-gray-500 ml-2">
              (Start typing for suggestions)
            </span>
          )}
        </label>
        <div className="relative">
          <Controller
            name={`${name}.address`}
            control={control}
            rules={{ required: required ? 'Address is required' : false }}
            render={({ field }) => (
              <input
                {...field}
                ref={addressInputRef}
                type="text"
                className="form-input pr-10"
                placeholder="123 Main Street"
                disabled={!selectedCountry}
              />
            )}
          />
          
        </div>
        {errors[`${name}.address`] && (
          <p className="form-error">{errors[`${name}.address`]?.message as string}</p>
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
                disabled={!selectedCountry}
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
                disabled={!selectedCountry}
              />
            )}
          />
          {errors[`${name}.city`] && (
            <p className="form-error">{errors[`${name}.city`]?.message as string}</p>
          )}
        </div>
      </div>

      {/* Postal Code and Address Line 2 */}
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
                disabled={!selectedCountry}
              />
            )}
          />
          {errors[`${name}.postalCode`] && (
            <p className="form-error">{errors[`${name}.postalCode`]?.message as string}</p>
          )}
        </div>

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
                placeholder="Apartment, suite, etc."
                disabled={!selectedCountry}
              />
            )}
          />
        </div>
      </div>
    </div>
  )
} 