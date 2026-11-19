@auth
Feature: Authentication
  In order to keep each farm's data private
  As a farm member
  I need to sign in before I can see anything and sign out when I am done

  @smoke @AUTH-01
  Scenario: Login screen renders for a visitor
    Given I am signed out
    When I open "/"
    Then I should see "Bem-vindo ao Suino Gestor"
    And I should see the button "Continuar com Google"

  @smoke @AUTH-02
  Scenario: Sign in with a local development account
    Given I am signed out
    When I open "/"
    And I click the button "Continuar com Google"
    And I pick the dev account "Carlos Nhantumbo"
    Then I should be on a page whose URL contains "/herd"
    And I should see the main navigation item "Animais"

  @AUTH-03
  Scenario: Sign out returns to the login screen
    Given I am signed in as the owner
    When I sign out from the user menu
    Then I should see "Sessão terminada com sucesso."
    And I should see the button "Continuar com Google"

  @AUTH-04
  Scenario: A deep link while signed out shows the login screen
    Given I am signed out
    When I open "/money"
    Then I should see "Bem-vindo ao Suino Gestor"
    And I should not see "Movimentos"
