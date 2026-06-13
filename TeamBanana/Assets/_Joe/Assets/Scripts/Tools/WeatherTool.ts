/**
 * Weather Tool - Spectacles weather services
 * Provides current temperature, weather conditions, and environmental data for butterfly activity analysis
 * Agents can call this tool to assess if conditions are favorable for butterfly observation
 */

export class WeatherTool {
  public readonly name = "weather_tool"
  public readonly description =
    "Get current weather conditions using Spectacles UserContextSystem for butterfly activity analysis"

  public readonly parameters = {
    type: "object",
    properties: {
      useCelsius: {
        type: "boolean",
        description: "Return temperature in Celsius (default true). Set false for Fahrenheit.",
        default: true
      }
    },
    required: []
  }

  private lastWeatherData: {
    temperature: number
    condition: WeatherCondition
    conditionString: string
    timestamp: number
  } | null = null

  private fetchPromise: Promise<void> | null = null

  constructor() {
    try {
      print("WeatherTool: Initialized with Spectacles UserContextSystem")
    } catch (error) {
      print(`WeatherTool: ERROR - Failed to initialize: ${error}`)
      throw error
    }
  }

  public async execute(args: Record<string, unknown>): Promise<{
    success: boolean
    result?: {
      temperature: number
      condition: WeatherCondition
      conditionString: string
      isButterflyWeather: boolean
      butterflyActivityLevel: "low" | "moderate" | "high"
      timestamp: number
    }
    error?: string
  }> {
    try {
      const useCelsius = (args.useCelsius as boolean) ?? true
      print("WeatherTool: Executing weather query...")

      if (!this.lastWeatherData || Date.now() - this.lastWeatherData.timestamp > 60000) {
        await this.waitForWeatherUpdate()
      }

      if (!this.lastWeatherData) {
        return {
          success: false,
          error: "Unable to retrieve weather data. Weather services may be unavailable."
        }
      }

      let temperature = this.lastWeatherData.temperature
      if (!useCelsius) {
        temperature = this.celsiusToFahrenheit(temperature)
      }

      const result = {
        temperature: temperature,
        condition: this.lastWeatherData.condition,
        conditionString: this.lastWeatherData.conditionString,
        isButterflyWeather: this.isButterflyWeather(this.lastWeatherData.temperature, this.lastWeatherData.condition),
        butterflyActivityLevel: this.getButterflyActivityLevel(this.lastWeatherData.temperature, this.lastWeatherData.condition),
        timestamp: this.lastWeatherData.timestamp
      }

      print(`WeatherTool: Retrieved weather - ${temperature.toFixed(1)}${useCelsius ? "°C" : "°F"}, ${this.lastWeatherData.conditionString}`)

      return {
        success: true,
        result: result
      }
    } catch (error) {
      print(`WeatherTool: ERROR - Weather fetch failed: ${error}`)
      return {
        success: false,
        error: `Weather tool failed: ${error}`
      }
    }
  }

  private async waitForWeatherUpdate(): Promise<void> {
    if (this.fetchPromise !== null) {
      return this.fetchPromise
    }

    this.fetchPromise = new Promise((resolve, reject) => {
      let resolved = false
      let updateCount = 0
      const requiredUpdates = 2

      if (this.lastWeatherData && Date.now() - this.lastWeatherData.timestamp < 60000) {
        resolve()
        this.fetchPromise = null
        return
      }

      if (!this.lastWeatherData) {
        this.lastWeatherData = {
          temperature: 0,
          condition: WeatherCondition.Unknown,
          conditionString: "Unknown",
          timestamp: 0
        }
      }

      const tempCallback = (tempCelsius: number) => {
        if (!resolved) {
          this.lastWeatherData!.temperature = tempCelsius
          this.lastWeatherData!.timestamp = Date.now()
          updateCount++

          if (updateCount >= requiredUpdates) {
            resolved = true
            resolve()
            this.fetchPromise = null
          }
        }
      }

      const conditionCallback = (condition: WeatherCondition) => {
        if (!resolved) {
          const conditionString = this.weatherConditionToString(condition)
          this.lastWeatherData!.condition = condition
          this.lastWeatherData!.conditionString = conditionString
          this.lastWeatherData!.timestamp = Date.now()
          updateCount++

          if (updateCount >= requiredUpdates) {
            resolved = true
            resolve()
            this.fetchPromise = null
          }
        }
      }

      try {
        const userContextSystem = UserContextSystem as any
        userContextSystem.requestTemperatureCelsius(tempCallback)
        userContextSystem.requestWeatherCondition(conditionCallback)
      } catch (error) {
        reject(new Error(`Failed to request weather data: ${error}`))
        this.fetchPromise = null
      }
    })

    return this.fetchPromise
  }

  private weatherConditionToString(condition: WeatherCondition): string {
    if (condition == WeatherCondition.Unknown) {
      return "Unknown"
    }
    if (condition == WeatherCondition.Lightning) {
      return "Lightning"
    }
    if (condition == WeatherCondition.LowVisibility) {
      return "Low Visibility"
    }
    if (condition == WeatherCondition.PartlyCloudy) {
      return "Partly Cloudy"
    }
    if (condition == WeatherCondition.ClearNight) {
      return "Clear Night"
    }
    if (condition == WeatherCondition.Cloudy) {
      return "Cloudy"
    }
    if (condition == WeatherCondition.Rainy) {
      return "Rainy"
    }
    if (condition == WeatherCondition.Hail) {
      return "Hail"
    }
    if (condition == WeatherCondition.Snow) {
      return "Snow"
    }
    if (condition == WeatherCondition.Windy) {
      return "Windy"
    }
    if (condition == WeatherCondition.Sunny) {
      return "Sunny"
    }
    return "Unknown"
  }

  private isButterflyWeather(temperatureCelsius: number, condition: WeatherCondition): boolean {
    if (temperatureCelsius < 10 || temperatureCelsius > 35) {
      return false
    }

    if (condition == WeatherCondition.Sunny || condition == WeatherCondition.PartlyCloudy || condition == WeatherCondition.ClearNight) {
      return true
    }

    return false
  }

  private getButterflyActivityLevel(temperatureCelsius: number, condition: WeatherCondition): "low" | "moderate" | "high" {
    let tempScore = 0
    if (temperatureCelsius >= 18 && temperatureCelsius <= 30) {
      tempScore = 2
    } else if (temperatureCelsius >= 15 && temperatureCelsius <= 35) {
      tempScore = 1
    }

    let conditionScore = 0
    if (condition == WeatherCondition.Sunny || condition == WeatherCondition.PartlyCloudy) {
      conditionScore = 2
    } else if (condition == WeatherCondition.ClearNight) {
      conditionScore = 1
    } else if (condition == WeatherCondition.Cloudy || condition == WeatherCondition.Windy || condition == WeatherCondition.LowVisibility) {
      conditionScore = 0
    } else {
      conditionScore = -1
    }

    const totalScore = tempScore + conditionScore

    if (totalScore >= 3) {
      return "high"
    } else if (totalScore >= 1) {
      return "moderate"
    } else {
      return "low"
    }
  }

  private celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9) / 5 + 32
  }

  public getSunlightLevel(): "direct" | "filtered" | "shade" {
    if (!this.lastWeatherData) {
      return "filtered"
    }

    const condition = this.lastWeatherData.condition

    if (condition == WeatherCondition.Sunny) {
      return "direct"
    } else if (condition == WeatherCondition.PartlyCloudy || condition == WeatherCondition.ClearNight) {
      return "filtered"
    } else {
      return "shade"
    }
  }

  public getWindLevel(): "calm" | "moderate" | "windy" {
    if (!this.lastWeatherData) {
      return "calm"
    }

    const condition = this.lastWeatherData.condition

    if (condition == WeatherCondition.Windy) {
      return "windy"
    } else if (condition == WeatherCondition.Lightning) {
      return "moderate"
    } else {
      return "calm"
    }
  }

  public getWeatherSummary(): string {
    if (!this.lastWeatherData) {
      return "Weather data not available"
    }

    const temperature = this.lastWeatherData.temperature
    const conditionString = this.lastWeatherData.conditionString
    const sunlight = this.getSunlightLevel()
    const wind = this.getWindLevel()
    const activity = this.getButterflyActivityLevel(temperature, this.lastWeatherData.condition)

    return `${temperature.toFixed(1)}°C, ${conditionString}. Sunlight: ${sunlight}, Wind: ${wind}. Butterfly activity: ${activity}`
  }
}
