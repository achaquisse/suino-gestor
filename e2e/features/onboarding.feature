@onboarding
Feature: Onboarding
  In order to start using the app
  As a new user without a farm
  I need to be told how to get access, since only the super admin creates farms

  @smoke @ONB-01
  Scenario: A new user without a farm is asked to get an invite
    Given I am signed in as the newcomer
    Then I should see "Ainda não tem acesso a nenhuma granja."
    And I should see my email address
    And I should see the button "Verificar de novo"

  @rbac @ONB-02
  Scenario: A new user cannot create a farm
    Given I am signed in as the newcomer
    Then I should not see the button "Criar granja"
    And I should not see the button "Criar com dados de exemplo"
    When I open "/welcome"
    Then I should see "Ainda não tem acesso a nenhuma granja."
    When I open "/admin"
    Then I should see "Ainda não tem acesso a nenhuma granja."
